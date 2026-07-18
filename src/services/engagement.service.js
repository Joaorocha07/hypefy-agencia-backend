const prisma = require('../config/db');
const AppError = require('../utils/appError');
const baratosSociais = require('./baratosSociais.service');

const CACHE_TTL_MS = 30 * 60 * 1000;
let servicesCache = { data: null, fetchedAt: 0 };

async function getExternalServices({ forceRefresh = false } = {}) {
  const isStale = Date.now() - servicesCache.fetchedAt > CACHE_TTL_MS;

  if (forceRefresh || isStale || !servicesCache.data) {
    const data = await baratosSociais.getServices();
    servicesCache = { data, fetchedAt: Date.now() };
  }

  return servicesCache.data;
}

async function getBalance() {
  return baratosSociais.getBalance();
}

// preco_venda = rate * (quantidade / 1000) * (1 + margem / 100)
function computeSellPrice(rate, quantity, profitMarginPercent) {
  const base = Number(rate) * (Number(quantity) / 1000);
  return base * (1 + Number(profitMarginPercent) / 100);
}

async function setProductMargin(productId, { baratosSociaisServiceId, profitMarginPercent }) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { category: true } });
  if (!product) throw new AppError('Produto não encontrado', 404);
  if (product.category.name !== 'ENGAJAMENTO') {
    throw new AppError('Produto não é um serviço de engajamento', 422);
  }

  return prisma.product.update({
    where: { id: productId },
    data: { baratosSociaisServiceId, profitMarginPercent },
  });
}

async function createExternalOrder(order, product) {
  if (!product.baratosSociaisServiceId) {
    throw new AppError('Produto não está vinculado a um serviço da Baratos Sociais', 422);
  }

  const link = order.targetUrl || order.targetUsername;
  if (!link) throw new AppError('Link ou usuário alvo não informado no pedido', 422);

  const result = await baratosSociais.createOrder({
    serviceId: product.baratosSociaisServiceId,
    link,
    quantity: order.quantity,
  });

  return prisma.order.update({
    where: { id: order.id },
    data: {
      baratosSociaisOrderId: String(result.order),
      orderStatus: 'PROCESSING',
    },
  });
}

const EXTERNAL_STATUS_MAP = {
  Completed: 'COMPLETED',
  Canceled: 'CANCELLED',
  Cancelled: 'CANCELLED',
  Partial: 'PROCESSING',
  Processing: 'PROCESSING',
  'In progress': 'PROCESSING',
  Pending: 'PROCESSING',
};

async function syncProcessingOrders() {
  const orders = await prisma.order.findMany({
    where: {
      orderStatus: 'PROCESSING',
      baratosSociaisOrderId: { not: null },
    },
    select: { id: true, baratosSociaisOrderId: true },
  });

  if (orders.length === 0) return { synced: 0 };

  const chunks = [];
  for (let i = 0; i < orders.length; i += 100) {
    chunks.push(orders.slice(i, i + 100));
  }

  let synced = 0;
  for (const chunk of chunks) {
    const ids = chunk.map((o) => o.baratosSociaisOrderId);
    const statuses = await baratosSociais.getMultipleOrderStatus(ids);

    for (const order of chunk) {
      const info = statuses[order.baratosSociaisOrderId];
      if (!info || info.error) continue;

      const mapped = EXTERNAL_STATUS_MAP[info.status];
      if (mapped && mapped !== 'PROCESSING') {
        await prisma.order.update({ where: { id: order.id }, data: { orderStatus: mapped } });
        synced += 1;
      }

      // Atualiza o chat message para refletir o status mais recente ao recarregar a página
      const chatMsg = await prisma.chatMessage.findFirst({
        where: { orderId: order.id, message: { startsWith: 'ENGAGEMENT_STATUS:' } },
        select: { id: true, message: true },
      });
      if (chatMsg) {
        try {
          const payload = JSON.parse(chatMsg.message.slice('ENGAGEMENT_STATUS:'.length));
          payload.charge = info.charge ?? payload.charge;
          payload.startCount = info.start_count ?? payload.startCount;
          payload.status = info.status ?? payload.status;
          payload.remains = info.remains ?? payload.remains;
          await prisma.chatMessage.update({
            where: { id: chatMsg.id },
            data: { message: `ENGAGEMENT_STATUS:${JSON.stringify(payload)}` },
          });
        } catch (_) {}
      }
    }
  }

  return { synced };
}

async function requestRefill(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.baratosSociaisOrderId) {
    throw new AppError('Pedido não possui ordem externa associada', 404);
  }
  return baratosSociais.requestRefill(order.baratosSociaisOrderId);
}

async function getExternalOrderStatus(baratosSociaisOrderId) {
  return baratosSociais.getOrderStatus(baratosSociaisOrderId);
}

async function cancelExternalOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.baratosSociaisOrderId) {
    throw new AppError('Pedido não possui ordem externa associada', 404);
  }
  const result = await baratosSociais.cancelOrders([order.baratosSociaisOrderId]);
  const entry = Array.isArray(result) ? result[0] : null;

  if (entry && entry.cancel === 1) {
    await prisma.order.update({ where: { id: orderId }, data: { orderStatus: 'CANCELLED' } });
  }

  return result;
}

module.exports = {
  getExternalServices,
  getBalance,
  computeSellPrice,
  setProductMargin,
  createExternalOrder,
  getExternalOrderStatus,
  syncProcessingOrders,
  requestRefill,
  cancelExternalOrder,
};
