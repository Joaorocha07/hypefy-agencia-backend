const crypto = require('crypto');
const { paymentClient } = require('../config/mercadoPago');
const AppError = require('../utils/appError');

async function createPixPayment({ amount, description, payerEmail, externalReference }) {
  const payment = await paymentClient.create({
    body: {
      transaction_amount: Number(amount),
      description,
      payment_method_id: 'pix',
      payer: { email: payerEmail },
      external_reference: externalReference,
      notification_url: process.env.MP_WEBHOOK_URL || undefined,
    },
  });

  const transactionData = payment.point_of_interaction?.transaction_data || {};

  return {
    paymentId: String(payment.id),
    status: payment.status,
    qrCode: transactionData.qr_code,
    qrCodeBase64: transactionData.qr_code_base64,
  };
}

async function getPayment(paymentId) {
  return paymentClient.get({ id: paymentId });
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

module.exports = { createPixPayment, getPayment, verifyWebhookSignature };
