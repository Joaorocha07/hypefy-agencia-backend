const prisma = require('../config/db');
const AppError = require('../utils/appError');
const couponService = require('./coupon.service');
const engagementService = require('./engagement.service');
const paymentService = require('./payment.service');

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
  const { productId, quantity, couponCode, targetUsername, targetUrl } = data;

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { category: true } });
  if (!product || !product.isActive) throw new AppError('Produto não encontrado ou indisponível', 404);

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (product.category.name === 'ENGAJAMENTO') {
    if (!targetUsername && !targetUrl) {
      throw new AppError('Informe o @usuário ou link do perfil/post alvo', 422);
    }
  } else {
    if (product.stockQuantity < quantity) {
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
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
    },
  });

  const payment = await paymentService.createPixPayment({
    amount: totalPrice,
    description: product.title,
    payerEmail: user.email,
    externalReference: order.id,
  });

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
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
      data: { isSold: true, soldToUserId: order.userId, soldAt: new Date() },
    });

    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: { decrement: order.quantity } },
    });

    const deliveredContent = stockItems.map((s) => s.content).join('\n---\n');

    await tx.chatMessage.create({
      data: {
        orderId: order.id,
        sender: 'SYSTEM',
        message: deliveredContent,
        isDelivery: true,
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
      await engagementService.createExternalOrder(order, order.product);
      await prisma.chatMessage.create({
        data: {
          orderId: order.id,
          sender: 'SYSTEM',
          message: 'Pagamento confirmado! Seu pedido de engajamento foi enviado para processamento.',
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
  listUserOrders,
  getOrderForUser,
  listAllOrders,
  getOrderAdmin,
};
