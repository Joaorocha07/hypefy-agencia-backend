const cron = require('node-cron');
const refreshTokenService = require('../services/refreshToken.service');

function startPurgeExpiredRefreshTokensJob() {
  // Diariamente às 03:30, remove refresh tokens expirados ou revogados
  cron.schedule('30 3 * * *', async () => {
    try {
      const { purged } = await refreshTokenService.purgeExpired();
      if (purged > 0) {
        console.log(`[purgeExpiredRefreshTokens] ${purged} refresh token(s) removido(s)`);
      }
    } catch (err) {
      console.error('[purgeExpiredRefreshTokens] erro ao purgar tokens:', err.message);
    }
  });
}

module.exports = { startPurgeExpiredRefreshTokensJob };
