require('dotenv').config({ quiet: true });

const { validateEnv } = require('./config/validateEnv');
validateEnv();

const app = require('./app');
const { startSyncEngagementOrdersJob } = require('./jobs/syncEngagementOrders');
const { startExpirePendingOrdersJob } = require('./jobs/expirePendingOrders');
const { startReconcilePixOrdersJob } = require('./jobs/reconcilePixOrders');
const { startPurgeFailedOrdersJob } = require('./jobs/purgeFailedOrders');
const { startPurgeExpiredRefreshTokensJob } = require('./jobs/purgeExpiredRefreshTokens');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Hypefy Agência API rodando na porta ${PORT} (commit ${process.env.RENDER_GIT_COMMIT || 'local'})`);
  console.log(`Documentação Swagger: http://localhost:${PORT}/docs`);

  startSyncEngagementOrdersJob();
  startReconcilePixOrdersJob();
  startExpirePendingOrdersJob();
  startPurgeFailedOrdersJob();
  startPurgeExpiredRefreshTokensJob();
});
