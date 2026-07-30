const prisma = require('../config/db');
const AppError = require('../utils/appError');
const { hashPassword, comparePassword, generateRandomToken, hashToken } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendMail } = require('../config/mailer');
const storageService = require('./storage.service');
const googleClient = require('../config/google');
const refreshTokenService = require('./refreshToken.service');

// Hash bcrypt fixo (não corresponde a nenhuma senha real) usado só para gastar
// o mesmo tempo de CPU que um bcrypt.compare real quando o usuário não existe
// ou não tem senha local — sem isso, a ausência dessa chamada torna a resposta
// perceptivelmente mais rápida e permite inferir quais emails têm conta.
const DUMMY_PASSWORD_HASH = '$2b$12$YklG3Lq5DaZtC/wxz3UXLOQIfZctk6Ie8zgTpio86JAc7ESWx10QO';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

function toPublicUser(user) {
  const { passwordHash, passwordResetToken, passwordResetExpires, googleId, failedLoginAttempts, lockedUntil, ...publicUser } = user;
  return publicUser;
}

async function issueTokens(user) {
  const payload = { sub: user.id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await refreshTokenService.store(user.id, refreshToken);

  return { accessToken, refreshToken };
}

async function register({ email, password, name, phone }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Este email já está cadastrado', 409);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, phone, role: 'USER' },
  });

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError('Conta temporariamente bloqueada por muitas tentativas de login. Tente novamente mais tarde.', 429);
  }

  const hashToCompare = user?.passwordHash || DUMMY_PASSWORD_HASH;
  const passwordMatches = await comparePassword(password, hashToCompare);

  if (!user || !user.passwordHash || !passwordMatches) {
    if (user) await registerFailedLoginAttempt(user);
    throw new AppError('Email ou senha inválidos', 401);
  }

  if (!user.isActive) throw new AppError('Usuário inativo', 403);

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

async function registerFailedLoginAttempt(user) {
  const attempts = user.failedLoginAttempts + 1;
  const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: shouldLock ? 0 : attempts,
      lockedUntil: shouldLock ? new Date(Date.now() + LOGIN_LOCK_DURATION_MS) : null,
    },
  });
}

async function loginWithGoogle(idToken) {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError('Token do Google inválido', 401);
  }

  if (!payload || !payload.email_verified) {
    throw new AppError('Email do Google não verificado', 401);
  }

  const { sub: googleId, email, name, picture } = payload;

  let user = await prisma.user.findUnique({ where: { googleId } });

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatarUrl: user.avatarUrl || picture,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          name,
          avatarUrl: picture,
          role: 'USER',
        },
      });
    }
  }

  if (!user.isActive) throw new AppError('Usuário inativo', 403);

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Refresh token inválido ou expirado', 401);
  }

  const stored = await refreshTokenService.findActiveByToken(refreshToken);
  if (!stored || stored.userId !== payload.sub) {
    throw new AppError('Refresh token inválido ou expirado', 401);
  }

  if (stored.revokedAt) {
    // Reuso de um refresh token já rotacionado — sinal de possível roubo do
    // token: revoga todas as sessões desse usuário por precaução.
    await refreshTokenService.revokeAllForUser(stored.userId);
    throw new AppError('Refresh token inválido ou expirado', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw new AppError('Usuário inválido ou inativo', 401);

  await refreshTokenService.revoke(stored.id);
  return issueTokens(user);
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await refreshTokenService.revokeByToken(refreshToken);
}

async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const rawToken = generateRandomToken();
  const passwordResetToken = hashToken(rawToken);
  const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken, passwordResetExpires },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/redefinir-senha?token=${rawToken}`;
  await sendMail({
    to: user.email,
    subject: 'Redefinição de senha — Hypefy Agência',
    html: `<p>Você solicitou a redefinição de senha.</p>
           <p>Clique no link abaixo para criar uma nova senha (válido por 1 hora):</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>Se não foi você, ignore este email.</p>`,
  });
}

// Falha no envio desse aviso não deve derrubar uma troca de senha que já foi
// aplicada no banco — só loga, nunca propaga para o controller.
async function notifyPasswordChanged(user) {
  try {
    await sendMail({
      to: user.email,
      subject: 'Sua senha foi alterada — Hypefy Agência',
      html: `<p>Olá${user.name ? `, ${user.name}` : ''}!</p>
             <p>Confirmamos que a senha da sua conta Hypefy Agência foi alterada agora há pouco.</p>
             <p>Se foi você, pode ignorar este email. Se não reconhece essa alteração, entre em contato com o suporte imediatamente.</p>`,
    });
  } catch (err) {
    console.error('Falha ao enviar email de senha alterada:', { userId: user.id, message: err.message });
  }
}

async function resetPassword({ token, newPassword }) {
  const passwordResetToken = hashToken(token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) throw new AppError('Token inválido ou expirado', 400);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
  });

  // Uma troca de senha (própria vontade ou recuperação) deve derrubar
  // qualquer sessão existente — inclusive a de quem roubou a senha antiga.
  await refreshTokenService.revokeAllForUser(user.id);
  await notifyPasswordChanged(user);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash || !(await comparePassword(currentPassword, user.passwordHash))) {
    throw new AppError('Senha atual incorreta', 401);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await refreshTokenService.revokeAllForUser(userId);
  await notifyPasswordChanged(user);
}

async function updateProfile(userId, { name, email, phone, cpf }, file) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado', 404);

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Este email já está cadastrado', 409);
  }

  let cpfDigits = user.cpf;
  if (cpf !== undefined) {
    cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      throw new AppError('CPF inválido', 422);
    }
    if (cpfDigits.length === 0) cpfDigits = null;
  }

  let phoneValue = user.phone;
  if (phone !== undefined) {
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length > 0 && phoneDigits.length < 10) {
      throw new AppError('Telefone inválido', 422);
    }
    phoneValue = phoneDigits.length === 0 ? null : phone;
  }

  let avatarUrl = user.avatarUrl;
  if (file) {
    const uploaded = await storageService.uploadImage(file, 'avatars');
    if (user.avatarUrl) await storageService.deleteImage(user.avatarUrl);
    avatarUrl = uploaded.url;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name, email, phone: phoneValue, cpf: cpfDigits, avatarUrl },
  });

  return toPublicUser(updated);
}

module.exports = {
  toPublicUser,
  register,
  login,
  loginWithGoogle,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
};
