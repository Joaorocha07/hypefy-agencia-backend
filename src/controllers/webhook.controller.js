const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/payment.service');
const orderService = require('../services/order.service');
const prisma = require('../config/db');

// Status da Orders API (não confundir com o status do Payment legado).
const PAID_ORDER_STATUSES = ['processed'];
const FAILED_ORDER_STATUSES = ['failed', 'canceled', 'expired'];

const handleMercadoPago = asyncHandler(async (req, res) => {
  // Responde 200 rapidamente pro MP não reenviar; qualquer erro de negócio é tratado/logado internamente.
  try {
    paymentService.verifyWebhookSignature(req);

    const type = req.query.type || req.body?.type;
    const dataId = req.query['data.id'] || req.body?.data?.id;

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
