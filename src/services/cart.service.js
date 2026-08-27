const prisma = require('../config/db');
const AppError = require('../utils/appError');
const couponService = require('./coupon.service');
const orderService = require('./order.service');
const paymentService = require('./payment.service');

// Acima desse subtotal o carrinho ganha CART_DISCOUNT_PERCENT% de desconto
// automático — sem precisar de cupom. Se o cliente também tiver um cupom
// aplicado, só vale o maior desconto dos dois (nunca somam).
const CART_DISCOUNT_THRESHOLD = 100;
const CART_DISCOUNT_PERCENT = 10;

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: undefined, lastName: undefined };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || undefined };
}

function mercadoPagoCategoryId(categoryName) {
  return categoryName === 'ENGAJAMENTO' ? 'services' : 'games';
}

// Junta quantidades repetidas do mesmo produto num único item — evita duas
// linhas de Order pro mesmo produto e simplifica a checagem de estoque.
function mergeItems(items) {
  const byProduct = new Map();
  for (const item of items) {
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + quantity);
  }
  return Array.from(byProduct.entries()).map(([productId, quantity]) => ({ productId, quantity }));
}

// Núcleo de precificação do carrinho, compartilhado pela cotação (GET /cart/quote)
// e pelo checkout de verdade — garante que os dois calculem exatamente igual.
// Carrinho só aceita produtos "normais" (fora da categoria ENGAJAMENTO): esses
// têm preço fixo (sem cotação por quantidade nem campos de alvo/comentários),
// o que permite somar vários produtos num único pagamento combinado.
async function computeCartPricing(rawItems, couponCode) {
  const merged = mergeItems(rawItems);
  if (merged.length === 0) throw new AppError('O carrinho está vazio', 422);

  const products = await prisma.product.findMany({
    where: { id: { in: merged.map((i) => i.productId) } },
    include: { category: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = [];
  for (const { productId, quantity } of merged) {
    const product = byId.get(productId);
    if (!product || !product.isActive) {
      throw new AppError('Um dos produtos do carrinho não está mais disponível', 404, { productId });
    }
    if (product.category.name === 'ENGAJAMENTO') {
      throw new AppError(
        `"${product.title}" é um produto de engajamento e não pode ser adicionado ao carrinho — compre-o diretamente pela página do produto.`,
        422,
        { productId }
      );
    }

    const available = await prisma.stockItem.count({ where: { productId, isSold: false } });
    if (available < quantity) {
      throw new AppError(`Estoque insuficiente para "${product.title}"`, 409, { productId, available });
    }

    const unitPrice = Number(product.price);
    lines.push({ product, quantity, unitPrice, itemSubtotal: unitPrice * quantity });
  }

  const subtotal = lines.reduce((acc, l) => acc + l.itemSubtotal, 0);

  const autoDiscount = subtotal >= CART_DISCOUNT_THRESHOLD ? (subtotal * CART_DISCOUNT_PERCENT) / 100 : 0;
  const { discountAmount: couponDiscount, coupon } = await couponService.validateCoupon(couponCode, subtotal);

  // Cupom só "vence" em empate (ele consome um uso real; o desconto automático não).
  const usingCoupon = coupon !== null && couponDiscount >= autoDiscount;
  const discountAmount = usingCoupon ? couponDiscount : autoDiscount;
  const discountSource = usingCoupon ? 'COUPON' : discountAmount > 0 ? 'CART_THRESHOLD' : null;

  // Distribui o desconto proporcionalmente ao peso de cada item no subtotal —
  // a última linha absorve o resto do arredondamento pra soma bater exatamente.
  let distributed = 0;
  const items = lines.map((l, index) => {
    const isLast = index === lines.length - 1;
    const share = subtotal > 0 ? l.itemSubtotal / subtotal : 0;
    const itemDiscount = isLast
      ? Math.round((discountAmount - distributed) * 100) / 100
      : Math.round(discountAmount * share * 100) / 100;
    distributed += itemDiscount;

    return {
      product: l.product,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      itemSubtotal: l.itemSubtotal,
      itemDiscount,
      itemTotal: Math.max(l.itemSubtotal - itemDiscount, 0),
    };
  });

  const totalPrice = Math.max(subtotal - discountAmount, 0);

  return {
    items,
    subtotal,
    discountAmount,
    totalPrice,
    discountSource,
    coupon: usingCoupon ? coupon : null,
    nextDiscountAt: subtotal >= CART_DISCOUNT_THRESHOLD ? null : CART_DISCOUNT_THRESHOLD - subtotal,
  };
}

async function getCartQuote(rawItems, couponCode) {
  const { items, subtotal, discountAmount, totalPrice, discountSource, nextDiscountAt } = await computeCartPricing(
    rawItems,
    couponCode
  );

  return {
    items: items.map((i) => ({
      productId: i.product.id,
      title: i.product.title,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      itemTotal: i.itemTotal,
    })),
    subtotal,
    discountAmount,
    totalPrice,
    discountSource,
    discountThreshold: CART_DISCOUNT_THRESHOLD,
    discountPercent: CART_DISCOUNT_PERCENT,
    nextDiscountAt,
  };
}

async function createCartOrder(userId, data) {
  const {
    items: rawItems,
    couponCode,
    paymentMethod = 'PIX',
    cardToken,
    cardPaymentMethodId,
    cardIssuerId,
    cardPaymentTypeId,
    installments,
    deviceId,
  } = data;

  const resolvedPaymentMethod =
    paymentMethod === 'CREDIT_CARD' && cardPaymentTypeId === 'debit_card' ? 'DEBIT_CARD' : paymentMethod;

  const pricing = await computeCartPricing(rawItems, couponCode);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const { cartOrder, orders } = await prisma.$transaction(async (tx) => {
    const created = await tx.cartOrder.create({
      data: {
        userId,
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        totalPrice: pricing.totalPrice,
        discountSource: pricing.discountSource,
        couponCode: pricing.coupon ? pricing.coupon.code : null,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: 'PENDING',
      },
    });

    const createdOrders = [];
    for (const item of pricing.items) {
      const order = await tx.order.create({
        data: {
          userId,
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.itemTotal,
          discountAmount: item.itemDiscount,
          paymentMethod: resolvedPaymentMethod,
          paymentStatus: 'PENDING',
          orderStatus: 'PENDING',
          cartOrderId: created.id,
        },
      });
      createdOrders.push(order);
    }

    return { cartOrder: created, orders: createdOrders };
  });

  const { firstName, lastName } = splitName(user.name);

  let payment;
  try {
    payment = await paymentService.createMercadoPagoOrder({
      paymentMethod,
      amount: pricing.totalPrice,
      description: `Carrinho — ${pricing.items.length} produto${pricing.items.length === 1 ? '' : 's'}`,
      payerEmail: user.email,
      payerFirstName: firstName,
      payerLastName: lastName,
      payerCpf: user.cpf || undefined,
      externalReference: cartOrder.id,
      deviceId,
      // Cada item vira 1 linha descritiva com quantity=1 e o valor total já
      // com desconto (mesma convenção de order.service.js#createOrder) —
      // assim a soma das linhas bate exatamente com o amount cobrado.
      items: pricing.items.map((item) => ({
        title: item.product.title,
        quantity: 1,
        unitPrice: item.itemTotal,
        categoryId: mercadoPagoCategoryId(item.product.category.name),
      })),
      card:
        paymentMethod === 'CREDIT_CARD'
          ? {
              token: cardToken,
              paymentMethodId: cardPaymentMethodId,
              issuerId: cardIssuerId,
              installments,
              type: cardPaymentTypeId,
            }
          : undefined,
    });
  } catch (err) {
    await markCartOrderAsFailed(cartOrder.id);
    console.error('Falha ao criar pagamento do carrinho no Mercado Pago:', {
      cartOrderId: cartOrder.id,
      paymentMethod,
      message: err.message,
      errors: err.errors,
    });
    throw new AppError('Não foi possível gerar o pagamento no momento. Tente novamente em instantes.', 502);
  }

  await prisma.cartOrder.update({
    where: { id: cartOrder.id },
    data: {
      mercadoPagoPaymentId: payment.paymentId,
      mercadoPagoQrCode: payment.qrCode,
      mercadoPagoQrCodeBase64: payment.qrCodeBase64,
    },
  });

  if (orderService.PAID_ORDER_STATUSES.includes(payment.status)) {
    return markCartOrderAsPaid(cartOrder.id);
  }
  if (orderService.FAILED_ORDER_STATUSES.includes(payment.status)) {
    return markCartOrderAsFailed(cartOrder.id);
  }

  return getCartOrderForUser(cartOrder.id, userId);
}

async function markCartOrderAsPaid(cartOrderId) {
  const cartOrder = await prisma.cartOrder.findUnique({
    where: { id: cartOrderId },
    include: { orders: { select: { id: true } } },
  });
  if (!cartOrder) throw new AppError('Carrinho não encontrado', 404);
  if (cartOrder.paymentStatus === 'PAID') return cartOrder; // idempotente

  await prisma.cartOrder.update({ where: { id: cartOrderId }, data: { paymentStatus: 'PAID' } });

  // Reaproveita markOrderAsPaid por item — cada produto passa pelo mesmo
  // fluxo de reserva de estoque/entrega/transação/email de uma compra direta.
  for (const order of cartOrder.orders) {
    await orderService.markOrderAsPaid(order.id);
  }

  // O uso do cupom é só do carrinho como um todo (1 uso), não por item — as
  // linhas de Order aqui não guardam couponCode, então markOrderAsPaid nunca
  // registra o uso sozinho; é feito uma única vez aqui.
  if (cartOrder.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: cartOrder.couponCode } });
    if (coupon) await couponService.registerCouponUse(coupon.id);
  }

  return prisma.cartOrder.findUnique({ where: { id: cartOrderId }, include: { orders: true } });
}

async function markCartOrderAsFailed(cartOrderId) {
  const cartOrder = await prisma.cartOrder.findUnique({ where: { id: cartOrderId } });
  if (!cartOrder || cartOrder.paymentStatus === 'PAID') return cartOrder;

  await prisma.order.updateMany({
    where: { cartOrderId },
    data: { paymentStatus: 'FAILED', orderStatus: 'CANCELLED' },
  });

  return prisma.cartOrder.update({ where: { id: cartOrderId }, data: { paymentStatus: 'FAILED' } });
}

async function getCartOrderForUser(cartOrderId, userId) {
  const cartOrder = await prisma.cartOrder.findFirst({
    where: { id: cartOrderId, userId },
    include: { orders: { include: { product: { select: { id: true, title: true, imageUrl: true } } } } },
  });
  if (!cartOrder) throw new AppError('Carrinho não encontrado', 404);
  return cartOrder;
}

// Mesma rede de segurança de reconcilePendingPixOrders/expireStalePendingOrders/
// purgeOldFailedOrders (order.service.js), só que operando no nível do CartOrder
// (o pagamento é combinado, então o status pendente/expirado/falho é dele, não
// de cada Order filho individualmente).
async function reconcilePendingCartOrders() {
  const pending = await prisma.cartOrder.findMany({
    where: { paymentStatus: 'PENDING', mercadoPagoPaymentId: { not: null } },
    select: { id: true, mercadoPagoPaymentId: true },
  });

  let reconciled = 0;
  for (const cartOrder of pending) {
    try {
      const mpOrder = await paymentService.getOrder(cartOrder.mercadoPagoPaymentId);
      if (orderService.PAID_ORDER_STATUSES.includes(mpOrder.status)) {
        await markCartOrderAsPaid(cartOrder.id);
        reconciled += 1;
      } else if (orderService.FAILED_ORDER_STATUSES.includes(mpOrder.status)) {
        await markCartOrderAsFailed(cartOrder.id);
        reconciled += 1;
      }
    } catch (err) {
      console.error(`[reconcilePendingCartOrders] erro ao consultar carrinho ${cartOrder.id}:`, err.message);
    }
  }
  return { checked: pending.length, reconciled };
}

async function expireStalePendingCartOrders() {
  const cutoff = new Date(Date.now() - orderService.PAYMENT_TIMEOUT_MINUTES * 60 * 1000);
  const stale = await prisma.cartOrder.findMany({
    where: { paymentStatus: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, orders: { select: { id: true } } },
  });
  if (stale.length === 0) return { expired: 0 };

  const cartOrderIds = stale.map((c) => c.id);
  const orderIds = stale.flatMap((c) => c.orders.map((o) => o.id));
  const result = await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { orderId: { in: orderIds } } }),
    // Reafirma paymentStatus: 'PENDING' — se o webhook confirmou o pagamento
    // entre o findMany acima e aqui, o carrinho não entra neste delete.
    prisma.order.deleteMany({ where: { cartOrderId: { in: cartOrderIds }, paymentStatus: 'PENDING' } }),
    prisma.cartOrder.deleteMany({ where: { id: { in: cartOrderIds }, paymentStatus: 'PENDING' } }),
  ]);
  return { expired: result[2].count };
}

async function purgeOldFailedCartOrders() {
  const cutoff = new Date(Date.now() - orderService.FAILED_ORDER_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const stale = await prisma.cartOrder.findMany({
    where: { paymentStatus: 'FAILED', createdAt: { lt: cutoff } },
    select: { id: true, orders: { select: { id: true } } },
  });
  if (stale.length === 0) return { purged: 0 };

  const cartOrderIds = stale.map((c) => c.id);
  const orderIds = stale.flatMap((c) => c.orders.map((o) => o.id));
  const result = await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.transaction.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { cartOrderId: { in: cartOrderIds } } }),
    prisma.cartOrder.deleteMany({ where: { id: { in: cartOrderIds } } }),
  ]);
  return { purged: result[3].count };
}

module.exports = {
  CART_DISCOUNT_THRESHOLD,
  CART_DISCOUNT_PERCENT,
  getCartQuote,
  createCartOrder,
  markCartOrderAsPaid,
  markCartOrderAsFailed,
  getCartOrderForUser,
  reconcilePendingCartOrders,
  expireStalePendingCartOrders,
  purgeOldFailedCartOrders,
};
