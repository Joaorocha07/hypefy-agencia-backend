const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/payment.service');
const orderService = require('../services/order.service');
const { PAID_ORDER_STATUSES, FAILED_ORDER_STATUSES } = orderService;
const prisma = require('../config/db');

const handleMercadoPago = asyncHandler(async (req, res) => {
  // Responde 200 rapidamente pro MP não reenviar; qualquer erro de negócio é tratado/logado internamente.
  try {
    paymentService.verifyWebhookSignature(req);

    const type = req.query.type || req.body?.type;
    const dataId = paymentService.getWebhookDataId(req);

    if (type === 'order' && dataId) {
      const mpOrder = await paymentService.getOrder(dataId);
      const order = await prisma.order.findFirst({
        where: { mercadoPagoPaymentId: String(dataId) },
      });

      if (order && PAID_ORDER_STATUSES.includes(mpOrder.status) && order.paymentStatus !== 'PAID') {
        await orderService.markOrderAsPaid(order.id);
      } else if (order && FAILED_ORDER_STATUSES.includes(mpOrder.status)) {
        await orderService.markOrderAsFailed(order.id);
      }
    }
  } catch (err) {
    console.error('[webhook mercado-pago] erro:', err.message);
  }

  res.status(200).send('OK');
});

module.exports = { handleMercadoPago };
