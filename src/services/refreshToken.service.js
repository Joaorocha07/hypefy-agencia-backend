const prisma = require('../config/db');
const { hashToken } = require('../utils/password');
const { decodeToken } = require('../utils/jwt');

// Rotação de refresh token cria uma condição de corrida real: o front dispara
// várias chamadas autenticadas em paralelo (AuthProvider, sino de notificação,
// listas de pedidos etc.), e se o access token expirar bem no meio disso, cada
// uma tenta renovar com o MESMO refresh token ao mesmo tempo. A primeira rotaciona
// com sucesso; sem essa janela de graça, as demais veriam o token já revogado e
// (por segurança contra roubo) derrubariam TODAS as sessões do usuário — ele era
// deslogado bem antes dos 7 dias do refresh token, mesmo sem nada de errado.
// Guardando o par de tokens recém-emitido por alguns segundos, essas chamadas
// concorrentes recebem o mesmo resultado da rotação em vez de serem tratadas
// como reuso malicioso.
const ROTATION_GRACE_PERIOD_MS = 30 * 1000;
const rotationGraceCache = new Map();

function rememberRotation(oldRefreshToken, tokens) {
  const key = hashToken(oldRefreshToken);
  rotationGraceCache.set(key, tokens);
  setTimeout(() => rotationGraceCache.delete(key), ROTATION_GRACE_PERIOD_MS).unref();
}

function getGracedRotation(oldRefreshToken) {
  return rotationGraceCache.get(hashToken(oldRefreshToken)) ?? null;
}

// Chamadas concorrentes podem ambas ler o mesmo token como "ainda válido" antes
// de qualquer uma delas gravar a revogação (read-then-write não é atômico) — aí
// as duas tentam rotacionar o mesmo token e emitir tokens novos em paralelo, o
// que também arrisca colidir no token_hash (JWT tem granularidade de segundo no
// `iat`, então duas chamadas no mesmo segundo podem gerar o MESMO refresh token).
// Um UPDATE condicionado a revokedAt IS NULL é atômico no Postgres: só uma
// requisição consegue "reivindicar" o token pra rotacionar; as demais recebem
// count=0 e devem esperar pelo resultado da vencedora (ver waitForGracedRotation).
async function claimForRotation(id) {
  const result = await prisma.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count === 1;
}

// Poll curto pelo resultado gravado por rememberRotation — cobre o instante entre
// uma requisição perder a corrida em claimForRotation e a vencedora terminar de
// emitir e registrar os novos tokens (questão de milissegundos, não segundos).
async function waitForGracedRotation(oldRefreshToken, { attempts = 10, intervalMs = 50 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const graced = getGracedRotation(oldRefreshToken);
    if (graced) return graced;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return getGracedRotation(oldRefreshToken);
}

async function store(userId, refreshToken) {
  const decoded = decodeToken(refreshToken);
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    },
  });
}

async function findActiveByToken(refreshToken) {
  return prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
}

async function revoke(id) {
  return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
}

async function revokeByToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  // updateMany (não update) porque o token pode não existir mais — não deve lançar em logout.
  return prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeAllForUser(userId) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function purgeExpired() {
  const result = await prisma.refreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] },
  });
  return { purged: result.count };
}

module.exports = {
  store,
  findActiveByToken,
  revoke,
  revokeByToken,
  revokeAllForUser,
  purgeExpired,
  rememberRotation,
  getGracedRotation,
  claimForRotation,
  waitForGracedRotation,
};
