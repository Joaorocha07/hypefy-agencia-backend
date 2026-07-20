const prisma = require('../config/db');
const AppError = require('../utils/appError');
const couponService = require('./coupon.service');
const engagementService = require('./engagement.service');
const paymentService = require('./payment.service');
const { syncProductStockQuantity } = require('./stock.service');

// Status da Orders API do Mercado Pago (não confundir com o status do Payment legado).
// Compartilhado pelo webhook e pelo job de reconciliação (reconcilePendingPixOrders).
const PAID_ORDER_STATUSES = ['processed'];
const FAILED_ORDER_STATUSES = ['failed', 'canceled', 'expired'];

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: undefined, lastName: undefined };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || undefined };
}

// category_id da Orders API não tem enum fechado; usamos um mapeamento aproximado por setor.
function mercadoPagoCategoryId(categoryName) {
  return categoryName === 'ENGAJAMENTO' ? 'services' : 'games';
}

async function computePricing(product, quantity) {
  if (product.category.name === 'ENGAJAMENTO') {
    const services = await engagementService.getExternalServices();
    const external = Array.isArray(services)
      ? services.find((s) => String(s.service) === String(product.baratosSociaisServiceId))
      : null;

    if (!external) {
      throw new AppError('Serviço de engajamento indisponível no momento', 503);
    }

    if (quantity < Number(external.min) || quantity > Number(external.max)) {
      throw new AppError(`Quantidade deve estar entre ${external.min} e ${external.max}`, 422);
    }

    const totalPrice = engagementService.computeSellPrice(external.rate, quantity, product.profitMarginPercent);
    return { unitPrice: totalPrice / quantity, totalPrice };
  }

  return { unitPrice: Number(product.price), totalPrice: Number(product.price) * quantity };
}

async function createOrder(userId, data) {
  const { productId, couponCode, targetUsername, targetUrl, deviceId, customComments } = data;
  let { quantity } = data;

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { category: true } });
  if (!product || !product.isActive) throw new AppError('Produto não encontrado ou indisponível', 404);

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (product.category.name === 'ENGAJAMENTO') {
    if (!targetUsername && !targetUrl) {
      throw new AppError('Informe o @usuário ou link do perfil/post alvo', 422);
    }
    if (product.acceptsCustomComments) {
      const lines = (customComments || '').split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) throw new AppError('Informe pelo menos um comentário', 422);
      quantity = lines.length;
    }
  } else {
    // Checked live against real StockItem rows, not the cached Product.stockQuantity
    // counter — that field can only ever be a snapshot, and trusting it here is
    // exactly what let orders through (or blocked them) on stale data before.
    const available = await prisma.stockItem.count({ where: { productId: product.id, isSold: false } });
    if (available < quantity) {
      throw new AppError('Estoque insuficiente para este produto', 409);
    }
  }

  const { unitPrice, totalPrice: subtotal } = await computePricing(product, quantity);

  let discountAmount = 0;
  let coupon = null;
  if (couponCode) {
    const result = await couponService.validateCoupon(couponCode, subtotal);
    discountAmount = result.discountAmount;
    coupon = result.coupon;
  }

  const totalPrice = Math.max(subtotal - discountAmount, 0);

  const order = await prisma.order.create({
    data: {
      userId,
      productId,
      quantity,
      unitPrice,
      totalPrice,
      discountAmount,
      couponCode: coupon ? coupon.code : null,
      targetUsername,
      targetUrl,
      customComments: product.acceptsCustomComments ? (customComments || null) : null,
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
    },
  });

  const { firstName, lastName } = splitName(user.name);

  let payment;
  try {
    payment = await paymentService.createPixOrder({
      amount: totalPrice,
      description: product.title,
      payerEmail: user.email,
      payerFirstName: firstName,
      payerLastName: lastName,
      payerCpf: user.cpf || undefined,
      externalReference: order.id,
      deviceId,
      items: [
        {
          title: product.title,
          quantity: 1,
          unitPrice: totalPrice,
          categoryId: mercadoPagoCategoryId(product.category.name),
        },
      ],
    });
  } catch (err) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED', orderStatus: 'CANCELLED' },
    });
    console.error('Falha ao criar pagamento PIX no Mercado Pago:', JSON.stringify(err.errors ?? err, null, 2));
    throw new AppError('Não foi possível gerar o pagamento PIX no momento. Tente novamente em instantes.', 502);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      // mercadoPagoPaymentId guarda o ID da Order da Orders API (ex: ORD01...), usado pelo webhook para reconciliar.
      mercadoPagoPaymentId: payment.paymentId,
      mercadoPagoQrCode: payment.qrCode,
      mercadoPagoQrCodeBase64: payment.qrCodeBase64,
    },
  });

  return updatedOrder;
}

async function fulfillDigitalOrder(order, product) {
  return prisma.$transaction(async (tx) => {
    const stockItems = await tx.stockItem.findMany({
      where: { productId: product.id, isSold: false },
      take: order.quantity,
    });

    if (stockItems.length < order.quantity) {
      await tx.chatMessage.create({
        data: {
          orderId: order.id,
          sender: 'SYSTEM',
          message:
            'Pagamento confirmado! Estamos preparando sua entrega — nossa equipe irá concluir manualmente em breve.',
          isDelivery: false,
        },
      });
      return tx.order.update({ where: { id: order.id }, data: { orderStatus: 'PROCESSING' } });
    }

    const ids = stockItems.map((s) => s.id);
    await tx.stockItem.updateMany({
      where: { id: { in: ids } },
      data: { isSold: true, soldToUserId: order.userId, soldAt: new Date(), orderId: order.id },
    });

    await syncProductStockQuantity(tx, product.id);

    const deliveredContent = stockItems
      .map((s) => (s.pin ? `${s.content}\nPIN: ${s.pin}` : s.content))
      .join('\n---\n');

    await tx.chatMessage.create({
      data: {
        orderId: order.id,
        sender: 'SYSTEM',
        message: deliveredContent,
        isDelivery: true,
      },
    });

    await tx.chatMessage.create({
      data: {
        orderId: order.id,
        sender: 'SYSTEM',
        message: 'Seu acesso está nos dados acima. Qualquer problema, me chame!',
        isDelivery: false,
      },
    });

    return tx.order.update({
      where: { id: order.id },
      data: { orderStatus: 'COMPLETED', deliveredContent },
    });
  });
}

function computeOrderCost(order, product) {
  if (product.category.name === 'ENGAJAMENTO') {
    // custo da API independe do desconto de cupom aplicado ao cliente
    const subtotal = Number(order.totalPrice) + Number(order.discountAmount);
    const margin = Number(product.profitMarginPercent || 0);
    return subtotal / (1 + margin / 100);
  }
  return Number(product.costPrice || 0) * order.quantity;
}

async function markOrderAsPaid(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: { include: { category: true } } },
  });
  if (!order) throw new AppError('Pedido não encontrado', 404);
  if (order.paymentStatus === 'PAID') return order; // idempotente

  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'PAID' } });

  await prisma.transaction.create({
    data: {
      orderId: order.id,
      type: 'SALE',
      amount: order.totalPrice,
      description: `Venda: ${order.product.title}`,
    },
  });

  const cost = computeOrderCost(order, order.product);
  if (cost > 0) {
    await prisma.transaction.create({
      data: {
        orderId: order.id,
        type: 'COST',
        amount: cost,
        description:
          order.product.category.name === 'ENGAJAMENTO'
            ? `Custo API Baratos Sociais: ${order.product.title}`
            : `Custo de estoque: ${order.product.title}`,
      },
    });
  }

  if (order.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: order.couponCode } });
    if (coupon) await couponService.registerCouponUse(coupon.id);
  }

  if (order.product.category.name === 'ENGAJAMENTO') {
    try {
      const updatedOrder = await engagementService.createExternalOrder(order, order.product);

      let statusInfo = null;
      try {
        statusInfo = await engagementService.getExternalOrderStatus(updatedOrder.baratosSociaisOrderId);
      } catch (_) {}

      const payload = {
        id: updatedOrder.baratosSociaisOrderId,
        link: order.targetUrl || order.targetUsername,
        quantity: order.quantity,
        serviceId: order.product.baratosSociaisServiceId,
        totalPrice: Number(order.totalPrice),
        charge: statusInfo?.charge ?? null,
        startCount: statusInfo?.start_count ?? null,
        status: statusInfo?.status ?? 'Pending',
        remains: statusInfo?.remains ?? String(order.quantity),
      };

      await prisma.chatMessage.create({
        data: {
          orderId: order.id,
          sender: 'SYSTEM',
          message: `ENGAGEMENT_STATUS:${JSON.stringify(payload)}`,
          isDelivery: false,
        },
      });
    } catch (err) {
      await prisma.chatMessage.create({
        data: {
          orderId: order.id,
          sender: 'SYSTEM',
          message: 'Pagamento confirmado! Nossa equipe irá processar seu pedido manualmente em instantes.',
          isDelivery: false,
        },
      });
    }
  } else {
    await fulfillDigitalOrder(order, order.product);
  }

  return prisma.order.findUnique({ where: { id: orderId } });
}

async function markOrderAsFailed(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus === 'PAID') return order;

  return prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: 'FAILED', orderStatus: 'CANCELLED' },
  });
}

// Rede de segurança para quando o webhook do Mercado Pago não chega (túnel ngrok caiu,
// assinatura não bateu, notificação perdida etc.) — sem isso um pedido pago fica preso
// em "aguardando pagamento" para sempre, já que nada mais consulta o status na Mercado Pago.
async function reconcilePendingPixOrders() {
  const pending = await prisma.order.findMany({
    where: { paymentStatus: 'PENDING', mercadoPagoPaymentId: { not: null } },
    select: { id: true, mercadoPagoPaymentId: true },
  });

  let reconciled = 0;
  for (const order of pending) {
    try {
      const mpOrder = await paymentService.getOrder(order.mercadoPagoPaymentId);
      if (PAID_ORDER_STATUSES.includes(mpOrder.status)) {
        await markOrderAsPaid(order.id);
        reconciled += 1;
      } else if (FAILED_ORDER_STATUSES.includes(mpOrder.status)) {
        await markOrderAsFailed(order.id);
        reconciled += 1;
      }
    } catch (err) {
      console.error(`[reconcilePendingPixOrders] erro ao consultar pedido ${order.id}:`, err.message);
    }
  }
  return { checked: pending.length, reconciled };
}

// Pedidos que nunca receberam o PIX dentro do prazo não geraram estoque reservado,
// transação ou entrega (tudo isso só é criado em markOrderAsPaid), então podem ser
// removidos de vez — só chat_messages tem FK RESTRICT com orders, por isso o delete
// explícito antes de apagar o pedido.
const PAYMENT_TIMEOUT_MINUTES = 15;

const FAILED_ORDER_RETENTION_DAYS = 7;

async function purgeOldFailedOrders() {
  const cutoff = new Date(Date.now() - FAILED_ORDER_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: {
      OR: [{ paymentStatus: 'FAILED' }, { orderStatus: 'CANCELLED' }],
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });
  if (stale.length === 0) return { purged: 0 };

  const ids = stale.map((o) => o.id);
  const result = await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.transaction.deleteMany({ where: { orderId: { in: ids } } }),
    prisma.order.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return { purged: result[2].count };
}

async function expireStalePendingOrders() {
  const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: { paymentStatus: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (stale.length === 0) return { expired: 0 };

  const ids = stale.map((o) => o.id);
  const result = await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { orderId: { in: ids } } }),
    // Reafirma paymentStatus: 'PENDING' — se o webhook confirmou o pagamento
    // entre o findMany acima e aqui, o pedido não entra nesse delete.
    prisma.order.deleteMany({ where: { id: { in: ids }, paymentStatus: 'PENDING' } }),
  ]);
  return { expired: result[1].count };
}

async function getEngagementStatusForOrder(orderId, userId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, baratosSociaisOrderId: true },
  });
  if (!order) throw new AppError('Pedido não encontrado', 404);
  if (!order.baratosSociaisOrderId) throw new AppError('Pedido não possui ordem de engajamento associada', 422);

  const status = await engagementService.getExternalOrderStatus(order.baratosSociaisOrderId);

  // Persiste o status atualizado no chat message para que recarregar a página mostre os dados corretos
  const chatMsg = await prisma.chatMessage.findFirst({
    where: { orderId: order.id, message: { startsWith: 'ENGAGEMENT_STATUS:' } },
    select: { id: true, message: true },
  });
  if (chatMsg) {
    try {
      const payload = JSON.parse(chatMsg.message.slice('ENGAGEMENT_STATUS:'.length));
      payload.charge = status.charge ?? payload.charge;
      payload.startCount = status.start_count ?? payload.startCount;
      payload.status = status.status ?? payload.status;
      payload.remains = status.remains ?? payload.remains;
      await prisma.chatMessage.update({
        where: { id: chatMsg.id },
        data: { message: `ENGAGEMENT_STATUS:${JSON.stringify(payload)}` },
      });
    } catch (_) {}
  }

  return status;
}

async function listUserOrders(userId, { page = 1, limit = 20 } = {}) {
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        product: {
          select: { id: true, title: true, imageUrl: true, category: true, platform: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getOrderForUser(orderId, userId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { product: { include: { category: true, platform: true } } },
  });
  if (!order) throw new AppError('Pedido não encontrado', 404);
  return order;
}

async function listAllOrders({ paymentStatus, orderStatus, page = 1, limit = 20 } = {}) {
  const where = {
    ...(paymentStatus && { paymentStatus }),
    ...(orderStatus && { orderStatus }),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        product: { select: { id: true, title: true, category: true, platform: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getOrderAdmin(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: { include: { category: true, platform: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) throw new AppError('Pedido não encontrado', 404);
  return order;
}

module.exports = {
  createOrder,
  markOrderAsPaid,
  markOrderAsFailed,
  reconcilePendingPixOrders,
  expireStalePendingOrders,
  purgeOldFailedOrders,
  PAYMENT_TIMEOUT_MINUTES,
  FAILED_ORDER_RETENTION_DAYS,
  PAID_ORDER_STATUSES,
  FAILED_ORDER_STATUSES,
  listUserOrders,
  getOrderForUser,
  getEngagementStatusForOrder,
  listAllOrders,
  getOrderAdmin,
};
