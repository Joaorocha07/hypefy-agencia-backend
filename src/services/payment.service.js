const crypto = require('crypto');
const { orderClient } = require('../config/mercadoPago');
const AppError = require('../utils/appError');

async function createPixOrder({
  amount,
  description,
  payerEmail,
  payerFirstName,
  payerLastName,
  payerCpf,
  externalReference,
  deviceId,
  items,
}) {
  const totalAmount = Number(amount).toFixed(2);

  const order = await orderClient.create({
    body: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: totalAmount,
      description,
      external_reference: externalReference,
      payer: {
        email: payerEmail,
        first_name: payerFirstName,
        last_name: payerLastName,
        identification: payerCpf ? { type: 'CPF', number: payerCpf } : undefined,
      },
      transactions: {
        payments: [
          {
            amount: totalAmount,
            payment_method: {
              id: 'pix',
              type: 'bank_transfer',
              statement_descriptor: process.env.MP_STATEMENT_DESCRIPTOR || undefined,
            },
          },
        ],
      },
      items: items?.map((item) => ({
        title: item.title,
        category_id: item.categoryId,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice).toFixed(2),
      })),
      config: {
        statement_descriptor: process.env.MP_STATEMENT_DESCRIPTOR || undefined,
        online: process.env.MP_WEBHOOK_URL ? { callback_url: process.env.MP_WEBHOOK_URL } : undefined,
      },
    },
    requestOptions: deviceId ? { meliSessionId: deviceId } : undefined,
  });

  const paymentMethod = order.transactions?.payments?.[0]?.payment_method || {};

  return {
    paymentId: String(order.id), // ID da Order (ex: ORD01...), não de um Payment
    status: order.status,
    qrCode: paymentMethod.qr_code,
    qrCodeBase64: paymentMethod.qr_code_base64,
  };
}

async function getOrder(orderId) {
  return orderClient.get({ id: orderId });
}

// Valida a assinatura do webhook do Mercado Pago (header x-signature)
// Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/webhooks
function verifyWebhookSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // sem secret configurado, pula validação (dev)

  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  const dataId = req.query['data.id'] || req.query.id;

  if (!signatureHeader || !requestId || !dataId) {
    throw new AppError('Webhook sem cabeçalhos de assinatura', 401);
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [key, value] = p.split('=');
      return [key.trim(), value?.trim()];
    })
  );

  const { ts, v1 } = parts;
  if (!ts || !v1) throw new AppError('Assinatura de webhook malformada', 401);

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  if (expectedSignature !== v1) {
    throw new AppError('Assinatura de webhook inválida', 401);
  }

  return true;
}

module.exports = { createPixOrder, getOrder, verifyWebhookSignature };
