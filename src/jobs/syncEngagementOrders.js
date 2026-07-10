const cron = require('node-cron');
const engagementService = require('../services/engagement.service');

function startSyncEngagementOrdersJob() {
  // A cada 10 minutos, sincroniza status dos pedidos de engajamento em processamento
  cron.schedule('*/10 * * * *', async () => {
    try {
      const { synced } = await engagementService.syncProcessingOrders();
      if (synced > 0) {
        console.log(`[syncEngagementOrders] ${synced} pedido(s) atualizado(s)`);
      }
    } catch (err) {
      console.error('[syncEngagementOrders] erro ao sincronizar pedidos:', err.message);
    }
  });
}

module.exports = { startSyncEngagementOrdersJob };
