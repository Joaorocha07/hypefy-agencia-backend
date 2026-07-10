const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/payment.service');
const orderService = require('../services/order.service');
const prisma = require('../config/db');

const handleMercadoPago = asyncHandler(async (req, res) => {
  // Responde 200 rapidamente pro MP não reenviar; qualquer erro de negócio é tratado/logado internamente.
  try {
    paymentService.verifyWebhookSignature(req);

    const type = req.query.type || req.body?.type;
    const dataId = req.query['data.id'] || req.body?.data?.id;

    if (type === 'payment' && dataId) {
      const payment = await paymentService.getPayment(dataId);
      const order = await prisma.order.findFirst({
        where: { mercadoPagoPaymentId: String(dataId) },
      });

      if (order && payment.status === 'approved' && order.paymentStatus !== 'PAID') {
        await orderService.markOrderAsPaid(order.id);
      } else if (order && ['rejected', 'cancelled'].includes(payment.status)) {
        await orderService.markOrderAsFailed(order.id);
      }
    }
  } catch (err) {
    console.error('[webhook mercado-pago] erro:', err.message);
  }

  res.status(200).send('OK');
});

module.exports = { handleMercadoPago };
