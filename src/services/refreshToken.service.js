const prisma = require('../config/db');
const { hashToken } = require('../utils/password');
const { decodeToken } = require('../utils/jwt');

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

module.exports = { store, findActiveByToken, revoke, revokeByToken, revokeAllForUser, purgeExpired };
