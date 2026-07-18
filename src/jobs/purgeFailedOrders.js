const cron = require('node-cron');
const orderService = require('../services/order.service');

function startPurgeFailedOrdersJob() {
  // Diariamente às 03:00, remove pedidos falhos/cancelados com mais de 7 dias
  cron.schedule('0 3 * * *', async () => {
    try {
      const { purged } = await orderService.purgeOldFailedOrders();
      if (purged > 0) {
        console.log(`[purgeFailedOrders] ${purged} pedido(s) falho(s)/cancelado(s) removido(s)`);
      }
    } catch (err) {
      console.error('[purgeFailedOrders] erro ao purgar pedidos:', err.message);
    }
  });
}

module.exports = { startPurgeFailedOrdersJob };
