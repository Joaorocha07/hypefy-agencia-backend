const cron = require('node-cron');
const orderService = require('../services/order.service');
const cartService = require('../services/cart.service');

function startReconcilePixOrdersJob() {
  // A cada 2 minutos, consulta a Mercado Pago pelos pedidos ainda pendentes —
  // rede de segurança para quando o webhook não chega (ver order.service.js).
  cron.schedule('*/2 * * * *', async () => {
    try {
      const { reconciled } = await orderService.reconcilePendingPixOrders();
      if (reconciled > 0) {
        console.log(`[reconcilePixOrders] ${reconciled} pedido(s) reconciliado(s) com a Mercado Pago`);
      }
    } catch (err) {
      console.error('[reconcilePixOrders] erro ao reconciliar pedidos:', err.message);
    }

    try {
      const { reconciled } = await cartService.reconcilePendingCartOrders();
      if (reconciled > 0) {
        console.log(`[reconcilePixOrders] ${reconciled} carrinho(s) reconciliado(s) com a Mercado Pago`);
      }
    } catch (err) {
      console.error('[reconcilePixOrders] erro ao reconciliar carrinhos:', err.message);
    }
  });
}

module.exports = { startReconcilePixOrdersJob };
