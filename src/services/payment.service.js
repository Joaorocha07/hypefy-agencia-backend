const crypto = require('crypto');
const { orderClient } = require('../config/mercadoPago');
const AppError = require('../utils/appError');

// payment_method da Orders API: bloco muda por método, mas o resto do body
// (payer, items, config) é igual pra PIX e cartão — ver createMercadoPagoOrder.
function buildPaymentMethod(paymentMethod, card) {
  if (paymentMethod === 'CREDIT_CARD') {
    return {
      id: card.paymentMethodId,
      // Precisa bater com o tipo real do cartão tokenizado (cartões aceitam
      // crédito e débito) — declarar o tipo errado faz o Mercado Pago recusar
      // o pagamento por divergência entre o token e o payment_method.type.
      type: card.type === 'debit_card' ? 'debit_card' : 'credit_card',
      token: card.token,
      installments: card.installments,
      issuer_id: card.issuerId || undefined,
    };
  }

  return {
    id: 'pix',
    type: 'bank_transfer',
    statement_descriptor: process.env.MP_STATEMENT_DESCRIPTOR || undefined,
  };
}

async function createMercadoPagoOrder({
  paymentMethod = 'PIX',
  amount,
  description,
  payerEmail,
  payerFirstName,
  payerLastName,
  payerCpf,
  externalReference,
  deviceId,
  items,
  card,
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
            payment_method: buildPaymentMethod(paymentMethod, card),
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

  const orderPaymentMethod = order.transactions?.payments?.[0]?.payment_method || {};

  return {
    paymentId: String(order.id), // ID da Order (ex: ORD01...), não de um Payment
    status: order.status,
    qrCode: orderPaymentMethod.qr_code,
    qrCodeBase64: orderPaymentMethod.qr_code_base64,
  };
}

async function getOrder(orderId) {
  return orderClient.get({ id: orderId });
}

// Única fonte de verdade para extrair o data.id do webhook — usada tanto na
// verificação de assinatura quanto no processamento, para que ambas nunca
// avaliem IDs diferentes de uma mesma requisição.
function getWebhookDataId(req) {
  return req.query['data.id'] || req.body?.data?.id || req.query.id;
}

// Valida a assinatura do webhook do Mercado Pago (header x-signature)
// Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/webhooks
function verifyWebhookSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    // Falha fechado em produção: sem secret configurado, um notificador
    // externo poderia forçar reconciliação de qualquer pedido sob demanda.
    // Só em dev/local (sem MP_WEBHOOK_SECRET configurado) o pulo é aceitável.
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('MP_WEBHOOK_SECRET não configurado', 401);
    }
    return true;
  }

  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  const dataId = getWebhookDataId(req);

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

module.exports = { createMercadoPagoOrder, getOrder, verifyWebhookSignature, getWebhookDataId };
