const prisma = require('../config/db');
const AppError = require('../utils/appError');

/**
 * Recomputes Product.stockQuantity from the actual unsold StockItem rows and
 * writes it back. Always resyncing to the true count (instead of incrementing/
 * decrementing a cached counter) makes it self-healing: even if the field
 * drifted for any reason, the next stock mutation snaps it back to reality.
 */
async function syncProductStockQuantity(tx, productId) {
  const stockQuantity = await tx.stockItem.count({ where: { productId, isSold: false } });
  return tx.product.update({ where: { id: productId }, data: { stockQuantity } });
}

async function addStockItems(productId, items) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Produto não encontrado', 404);

  return prisma.$transaction(async (tx) => {
    await tx.stockItem.createMany({
      data: items.map((item) =>
        typeof item === 'string'
          ? { productId, content: item }
          : { productId, content: item.content, quantidade: item.quantidade, pin: item.pin ?? null }
      ),
    });

    return syncProductStockQuantity(tx, productId);
  });
}

// Vagas "vazias" (sem credenciais) para produtos cuja entrega é sempre manual
// — content fica em branco, e fulfillDigitalOrder detecta isManual pra mandar
// o aviso de WhatsApp em vez de tentar entregar credenciais inexistentes.
async function addManualStockSlots(productId, quantity) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Produto não encontrado', 404);

  return prisma.$transaction(async (tx) => {
    await tx.stockItem.createMany({
      data: Array.from({ length: quantity }, () => ({ productId, content: '', isManual: true })),
    });
    return syncProductStockQuantity(tx, productId);
  });
}

async function listStockItems(productId, { isSold, page = 1, limit = 50 }) {
  const where = { productId, ...(isSold !== undefined && { isSold }) };

  const [items, total] = await Promise.all([
    prisma.stockItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        isSold: true,
        soldToUserId: true,
        soldAt: true,
        createdAt: true,
        // conteúdo (credenciais) só é exposto via listStockAccounts (agrupado) ou nunca — ver ali
      },
    }),
    prisma.stockItem.count({ where }),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

/**
 * A "conta compartilhada" (shared account) sells the same credentials as many
 * seats — each seat is its own StockItem row, but they share identical
 * `content`. Grouping by content shows the account once (with available/sold
 * counts) instead of one indistinguishable row per seat. This is a distinct
 * view from listStockItems (raw, per-seat, used e.g. for movement history/
 * sparklines that need each seat's own createdAt/soldAt) — the management
 * table wants accounts, the history chart wants individual events.
 */
async function listStockAccounts(productId, { isSold, page = 1, limit = 50 }) {
  const allItems = await prisma.stockItem.findMany({
    where: { productId },
    orderBy: { createdAt: 'asc' },
    include: { lastEditedBy: { select: { name: true, email: true } } },
  });

  const groups = new Map();
  for (const item of allItems) {
    // Chave composta: vagas manuais têm content sempre vazio, então precisam de
    // uma chave própria pra não se misturarem entre si (nem, em tese, com uma
    // conta real que por engano tenha content vazio).
    const groupKey = `${item.isManual}:${item.content}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        content: item.content,
        isManual: item.isManual,
        quantidade: item.quantidade,
        availableId: null,
        anyId: item.id,
        available: 0,
        sold: 0,
        createdAt: item.createdAt,
        lastSoldAt: null,
        lastEditedAt: item.updatedAt,
        lastEditedByName: item.lastEditedBy ? item.lastEditedBy.name || item.lastEditedBy.email : null,
        screenPins: [],
      };
      groups.set(groupKey, group);
    }
    if (item.isSold) {
      group.sold += 1;
      if (!group.lastSoldAt || item.soldAt > group.lastSoldAt) group.lastSoldAt = item.soldAt;
    } else {
      group.available += 1;
      if (!group.availableId) group.availableId = item.id;
    }
    if (item.updatedAt > group.lastEditedAt) {
      group.lastEditedAt = item.updatedAt;
      group.lastEditedByName = item.lastEditedBy ? item.lastEditedBy.name || item.lastEditedBy.email : null;
    }
    group.screenPins.push({ id: item.id, pin: item.pin ?? null, isSold: item.isSold });
  }

  let groupList = Array.from(groups.values()).map((g) => ({
    id: g.availableId ?? g.anyId,
    content: g.content,
    isManual: g.isManual,
    quantidade: g.quantidade,
    available: g.available,
    sold: g.sold,
    createdAt: g.createdAt,
    lastSoldAt: g.lastSoldAt,
    lastEditedAt: g.lastEditedAt,
    lastEditedByName: g.lastEditedByName,
    screenPins: g.screenPins,
  }));

  if (isSold !== undefined) {
    groupList = groupList.filter((g) => (isSold ? g.sold > 0 : g.available > 0));
  }
  groupList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = groupList.length;
  const items = groupList.slice((page - 1) * limit, page * limit);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

/**
 * Edits the shared account's credentials — updates every StockItem (sold and
 * available) that currently has the same content as `itemId`, since they all
 * represent the same underlying account, not independent items. Only the most
 * recent edit (who/when) is tracked, not a full history log.
 *
 * `quantidade` doubles as the target row count for this account: each StockItem
 * row is one sellable seat, so if it's raised above how many rows currently
 * exist (e.g. an account that sold out and the admin wants one more seat
 * available), the difference is created as new available rows instead of just
 * being written as a cosmetic number — otherwise "esgotado" would stay wrong
 * forever after every edit.
 */
async function updateStockItemContent(itemId, content, editedByUserId, quantidade) {
  const item = await prisma.stockItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError('Item de estoque não encontrado', 404);

  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.stockItem.count({
      where: { productId: item.productId, content: item.content },
    });

    const result = await tx.stockItem.updateMany({
      where: { productId: item.productId, content: item.content },
      data: { content, lastEditedById: editedByUserId, ...(quantidade !== undefined && { quantidade }) },
    });

    let addedCount = 0;
    if (quantidade !== undefined && quantidade > existingCount) {
      addedCount = quantidade - existingCount;
      await tx.stockItem.createMany({
        data: Array.from({ length: addedCount }, () => ({ productId: item.productId, content, quantidade })),
      });
      await syncProductStockQuantity(tx, item.productId);
    }

    return { updatedCount: result.count, addedCount, content, quantidade: quantidade ?? item.quantidade };
  });
}

/**
 * Everyone who currently holds a seat on this shared account (sold items
 * sharing itemId's content), with their order + contact details — so staff
 * can see exactly who to reach out to, open their chat, or notify individually.
 */
async function updateScreenPin(itemId, pin) {
  const item = await prisma.stockItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError('Item de estoque não encontrado', 404);
  return prisma.stockItem.update({
    where: { id: itemId },
    data: { pin: pin ?? null },
    select: { id: true, pin: true },
  });
}

async function getAccountCustomers(itemId) {
  const anchor = await prisma.stockItem.findUnique({ where: { id: itemId } });
  if (!anchor) throw new AppError('Item de estoque não encontrado', 404);

  const soldItems = await prisma.stockItem.findMany({
    where: { productId: anchor.productId, content: anchor.content, isSold: true },
    include: {
      soldToUser: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      order: { select: { id: true, paymentStatus: true, orderStatus: true, createdAt: true } },
    },
    orderBy: { soldAt: 'desc' },
  });

  const results = await Promise.all(
    soldItems
      .filter((item) => item.order && item.soldToUser)
      .map(async (item) => {
        const lastUpdate = await prisma.chatMessage.findFirst({
          where: { orderId: item.order.id, isDelivery: true },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        return {
          stockItemId: item.id,
          orderId: item.order.id,
          paymentStatus: item.order.paymentStatus,
          orderStatus: item.order.orderStatus,
          orderCreatedAt: item.order.createdAt,
          customerId: item.soldToUser.id,
          customerName: item.soldToUser.name || item.soldToUser.email,
          customerEmail: item.soldToUser.email,
          customerPhone: item.soldToUser.phone,
          customerAvatarUrl: item.soldToUser.avatarUrl,
          lastAccessUpdateAt: lastUpdate ? lastUpdate.createdAt : null,
        };
      })
  );

  return results;
}

/**
 * Orders still "within term" for this product — paid orders created within the
 * last `accessDurationDays` days (all paid orders if no duration is set).
 * Shared by the notify-preview (who WILL be notified) and notify-send (who
 * actually gets messaged) endpoints, so they can never disagree.
 */
async function getEligibleOrdersForAccessUpdate(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Produto não encontrado', 404);

  const where = {
    productId,
    paymentStatus: 'PAID',
    ...(product.accessDurationDays && {
      createdAt: { gte: new Date(Date.now() - product.accessDurationDays * 24 * 60 * 60 * 1000) },
    }),
  };

  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, user: { select: { name: true, email: true, phone: true } } },
  });
}

async function previewAccessUpdateRecipients(productId) {
  const orders = await getEligibleOrdersForAccessUpdate(productId);
  return orders.map((o) => ({
    orderId: o.id,
    customerName: o.user.name || o.user.email,
    customerEmail: o.user.email,
    customerPhone: o.user.phone,
    orderCreatedAt: o.createdAt,
  }));
}

/**
 * Broadcasts updated access (e.g. a shared account's new password) to every
 * customer still "within term" for this product (see getEligibleOrdersForAccessUpdate),
 * or to a specific subset of those orderIds if provided (individual/selective send).
 * Posts an isDelivery chat message per order and refreshes Order.deliveredContent,
 * so both the chat and the order's delivery card show the new credentials. Logs the
 * broadcast to AccessUpdateLog — "Enviado" is the only real status since there's no
 * external channel (email/WhatsApp) whose delivery could fail.
 */
async function notifyAccessUpdate(productId, content, sentById, orderIds) {
  const eligibleOrders = await getEligibleOrdersForAccessUpdate(productId);
  const eligibleIds = new Set(eligibleOrders.map((o) => o.id));

  const targetIds = orderIds && orderIds.length > 0 ? orderIds.filter((id) => eligibleIds.has(id)) : [...eligibleIds];
  if (targetIds.length === 0) return { notifiedCount: 0 };

  await prisma.$transaction([
    prisma.chatMessage.createMany({
      data: targetIds.map((orderId) => ({ orderId, sender: 'SYSTEM', message: content, isDelivery: true })),
    }),
    prisma.chatMessage.createMany({
      data: targetIds.map((orderId) => ({
        orderId,
        sender: 'SYSTEM',
        message: 'As credenciais de acesso deste produto foram atualizadas. Confira os novos dados acima.',
        isDelivery: false,
      })),
    }),
    prisma.order.updateMany({ where: { id: { in: targetIds } }, data: { deliveredContent: content } }),
    prisma.accessUpdateLog.create({
      data: { productId, content, recipientCount: targetIds.length, sentById },
    }),
  ]);

  return { notifiedCount: targetIds.length };
}

async function getAccessUpdateLog(productId, limit = 10) {
  const entries = await prisma.accessUpdateLog.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { sentBy: { select: { name: true, email: true } } },
  });

  return entries.map((e) => ({
    id: e.id,
    recipientCount: e.recipientCount,
    sentByName: e.sentBy.name || e.sentBy.email,
    createdAt: e.createdAt,
    status: 'Enviado',
  }));
}

async function getStockOverview() {
  const products = await prisma.product.findMany({
    select: { id: true, title: true, price: true, costPrice: true, stockQuantity: true },
  });

  const grouped = await prisma.stockItem.groupBy({
    by: ['productId', 'isSold'],
    _count: { _all: true },
  });

  const byProduct = {};
  for (const g of grouped) {
    if (!byProduct[g.productId]) byProduct[g.productId] = { sold: 0, available: 0 };
    if (g.isSold) byProduct[g.productId].sold += g._count._all;
    else byProduct[g.productId].available += g._count._all;
  }

  let totalPurchaseCost = 0;
  let totalSoldValue = 0;
  let totalAvailable = 0;
  let totalSold = 0;

  const perProduct = products.map((p) => {
    const counts = byProduct[p.id] || { sold: 0, available: 0 };
    const costPrice = Number(p.costPrice || 0);
    const price = Number(p.price);

    const purchaseCost = costPrice * (counts.sold + counts.available);
    const soldValue = price * counts.sold;
    const estimatedProfit = soldValue - costPrice * counts.sold;

    totalPurchaseCost += purchaseCost;
    totalSoldValue += soldValue;
    totalAvailable += counts.available;
    totalSold += counts.sold;

    return {
      productId: p.id,
      title: p.title,
      available: counts.available,
      sold: counts.sold,
      purchaseCost,
      soldValue,
      estimatedProfit,
    };
  });

  return {
    totalAvailable,
    totalSold,
    totalPurchaseCost,
    totalSoldValue,
    totalEstimatedProfit: perProduct.reduce((acc, p) => acc + p.estimatedProfit, 0),
    perProduct,
  };
}

// Custo usado nos pedidos entregues por vaga manual (ver computeOrderCost em
// order.service.js) — separado de costPrice porque costuma variar e não tem
// relação com o custo de estoque "normal" do produto.
async function setManualCostPrice(productId, manualCostPrice) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Produto não encontrado', 404);

  return prisma.product.update({ where: { id: productId }, data: { manualCostPrice } });
}

module.exports = {
  addStockItems,
  addManualStockSlots,
  listStockItems,
  listStockAccounts,
  getStockOverview,
  syncProductStockQuantity,
  updateStockItemContent,
  updateScreenPin,
  getAccountCustomers,
  notifyAccessUpdate,
  previewAccessUpdateRecipients,
  getAccessUpdateLog,
  setManualCostPrice,
};
