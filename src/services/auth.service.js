const prisma = require('../config/db');
const AppError = require('../utils/appError');
const { hashPassword, comparePassword, generateRandomToken, hashToken } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendMail } = require('../config/mailer');
const storageService = require('./storage.service');
const googleClient = require('../config/google');

function toPublicUser(user) {
  const { passwordHash, passwordResetToken, passwordResetExpires, googleId, ...publicUser } = user;
  return publicUser;
}

function issueTokens(user) {
  const payload = { sub: user.id, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

async function register({ email, password, name, phone }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Este email já está cadastrado', 409);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, phone, role: 'USER' },
  });

  return { user: toPublicUser(user), ...issueTokens(user) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    throw new AppError('Email ou senha inválidos', 401);
  }
  if (!user.isActive) throw new AppError('Usuário inativo', 403);

  return { user: toPublicUser(user), ...issueTokens(user) };
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

  return { user: toPublicUser(user), ...issueTokens(user) };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Refresh token inválido ou expirado', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw new AppError('Usuário inválido ou inativo', 401);

  return issueTokens(user);
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

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  await sendMail({
    to: user.email,
    subject: 'Redefinição de senha — Hypefy Agência',
    html: `<p>Você solicitou a redefinição de senha.</p>
           <p>Clique no link abaixo para criar uma nova senha (válido por 1 hora):</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>Se não foi você, ignore este email.</p>`,
  });
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
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash || !(await comparePassword(currentPassword, user.passwordHash))) {
    throw new AppError('Senha atual incorreta', 401);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
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
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
};
