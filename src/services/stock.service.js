const prisma = require('../config/db');
const AppError = require('../utils/appError');

async function addStockItems(productId, items) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Produto não encontrado', 404);

  return prisma.$transaction(async (tx) => {
    await tx.stockItem.createMany({
      data: items.map((content) => ({ productId, content })),
    });

    return tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: items.length } },
    });
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
        // conteúdo (credenciais) só é exposto explicitamente via rota de detalhe
      },
    }),
    prisma.stockItem.count({ where }),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
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

module.exports = { addStockItems, listStockItems, getStockOverview };
