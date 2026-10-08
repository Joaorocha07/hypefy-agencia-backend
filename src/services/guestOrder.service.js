const crypto = require('crypto');
const prisma = require('../config/db');
const AppError = require('../utils/appError');
const { isValidCpf } = require('../utils/cpf');
const { isGuestCheckoutProduct } = require('../utils/guestCheckout');
const cartService = require('./cart.service');

// Checkout sem login (ex: /prompt-secreto/checkout): o comprador informa só
// email + CPF, e paga com PIX ou cartão (crédito/débito, parcelado). Restrito aos produtos de GUEST_CHECKOUT_PRODUCT_IDS (ver
// utils/guestCheckout.js). Usa o fluxo do carrinho mesmo com 1 produto — assim
// produto principal + order bump saem num único PIX, e webhook/reconciliação/
// expiração já tratam o CartOrder.

// Token de acompanhamento: sem sessão, é isso que prova que quem consulta o
// status é quem gerou o PIX (o id sozinho não basta).
function signOrderToken(cartOrderId) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`guest-cart:${cartOrderId}`).digest('base64url');
}

function verifyOrderToken(cartOrderId, token) {
  if (typeof token !== 'string') return false;
  const expected = Buffer.from(signOrderToken(cartOrderId));
  const received = Buffer.from(token);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

// Reaproveita a conta se o email já existe — mas nunca altera dados dela a
// partir de um formulário público (qualquer um pode digitar qualquer email).
async function findOrCreateGuestUser(email, cpfDigits) {
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (existing) {
    if (!existing.isActive) throw new AppError('Não foi possível concluir a compra com este email', 403);
    return existing;
  }
  return prisma.user.create({ data: { email: email.toLowerCase(), cpf: cpfDigits, role: 'USER' } });
}

async function createGuestOrder({ productIds, email, cpf, deviceId, paymentMethod, ...card }) {
  const uniqueIds = [...new Set(productIds)];
  if (!uniqueIds.every(isGuestCheckoutProduct)) {
    throw new AppError('Este produto não está disponível para compra sem login', 403);
  }

  const cpfDigits = cpf.replace(/\D/g, '');
  if (!isValidCpf(cpfDigits)) throw new AppError('CPF inválido', 422);

  const user = await findOrCreateGuestUser(email.trim(), cpfDigits);

  const cartOrder = await cartService.createCartOrder(user.id, {
    items: uniqueIds.map((productId) => ({ productId, quantity: 1 })),
    paymentMethod,
    payerCpf: cpfDigits,
    deviceId,
    cardToken: card.cardToken,
    cardPaymentMethodId: card.cardPaymentMethodId,
    cardIssuerId: card.cardIssuerId,
    cardPaymentTypeId: card.cardPaymentTypeId,
    installments: card.installments,
  });

  return {
    order: {
      id: cartOrder.id,
      totalPrice: cartOrder.totalPrice,
      paymentStatus: cartOrder.paymentStatus,
      mercadoPagoQrCode: cartOrder.mercadoPagoQrCode,
      mercadoPagoQrCodeBase64: cartOrder.mercadoPagoQrCodeBase64,
      createdAt: cartOrder.createdAt,
    },
    token: signOrderToken(cartOrder.id),
  };
}

async function getGuestOrderStatus(cartOrderId, token) {
  if (!verifyOrderToken(cartOrderId, token)) throw new AppError('Pedido não encontrado', 404);

  const cartOrder = await prisma.cartOrder.findUnique({
    where: { id: cartOrderId },
    select: { id: true, paymentStatus: true },
  });
  // PIX não pago é excluído após o prazo (cart.service#expireStalePendingCartOrders).
  if (!cartOrder) throw new AppError('Pedido não encontrado ou expirado', 404);
  return cartOrder;
}

module.exports = { createGuestOrder, getGuestOrderStatus };
