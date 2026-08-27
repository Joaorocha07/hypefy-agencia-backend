const cron = require('node-cron');
const orderService = require('../services/order.service');
const cartService = require('../services/cart.service');

function startExpirePendingOrdersJob() {
  // A cada minuto, exclui pedidos com PIX pendente há mais de 15 minutos
  cron.schedule('* * * * *', async () => {
    try {
      const { expired } = await orderService.expireStalePendingOrders();
      if (expired > 0) {
        console.log(`[expirePendingOrders] ${expired} pedido(s) expirado(s) e removido(s)`);
      }
    } catch (err) {
      console.error('[expirePendingOrders] erro ao expirar pedidos:', err.message);
    }

    try {
      const { expired } = await cartService.expireStalePendingCartOrders();
      if (expired > 0) {
        console.log(`[expirePendingOrders] ${expired} carrinho(s) expirado(s) e removido(s)`);
      }
    } catch (err) {
      console.error('[expirePendingOrders] erro ao expirar carrinhos:', err.message);
    }
  });
}

module.exports = { startExpirePendingOrdersJob };
