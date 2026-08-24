const prisma = require('../config/db');

function periodStartDate(period) {
  const now = new Date();
  switch (period) {
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

// Compartilhado pelo resumo do Dashboard e pelo cálculo de repasse de sócio
// (partner.service.js) — receita/custo/reembolso somados a partir de sinceDate
// (null = desde sempre).
async function getNetProfitSince(sinceDate = null) {
  const where = sinceDate ? { createdAt: { gte: sinceDate } } : {};

  const [salesAgg, costAgg, refundAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: 'SALE', ...where }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'COST', ...where }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'REFUND', ...where }, _sum: { amount: true } }),
  ]);

  const revenue = Number(salesAgg._sum.amount || 0);
  const costs = Number(costAgg._sum.amount || 0);
  const refunds = Number(refundAgg._sum.amount || 0);

  return { revenue, costs, refunds, netProfit: revenue - costs - refunds };
}

async function getSummary(period = 'month', visibleFrom = null) {
  let startDate = periodStartDate(period);
  if (visibleFrom && visibleFrom > startDate) startDate = visibleFrom;

  const paidOrders = await prisma.order.findMany({
    where: { paymentStatus: 'PAID', createdAt: { gte: startDate } },
    select: { id: true, totalPrice: true },
  });

  const totalSales = paidOrders.reduce((acc, o) => acc + Number(o.totalPrice), 0);
  const orderCount = paidOrders.length;
  const averageTicket = orderCount > 0 ? totalSales / orderCount : 0;

  const { revenue, costs, refunds, netProfit } = await getNetProfitSince(startDate);

  return {
    period,
    since: startDate,
    totalSales,
    orderCount,
    averageTicket,
    revenue,
    costs,
    refunds,
    netProfit,
  };
}

async function getDetailedReport({ startDate, endDate, productId, userId }, visibleFrom = null) {
  let effectiveStartDate = startDate ? new Date(startDate) : null;
  if (visibleFrom && (!effectiveStartDate || visibleFrom > effectiveStartDate)) {
    effectiveStartDate = visibleFrom;
  }

  const where = {
    paymentStatus: 'PAID',
    ...(effectiveStartDate && { createdAt: { gte: effectiveStartDate } }),
    ...(endDate && {
      createdAt: { ...(effectiveStartDate && { gte: effectiveStartDate }), lte: new Date(endDate) },
    }),
    ...(productId && { productId }),
    ...(userId && { userId }),
  };

  const orders = await prisma.order.findMany({
    where,
    include: {
      product: { select: { id: true, title: true, category: true, platform: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalRevenue = orders.reduce((acc, o) => acc + Number(o.totalPrice), 0);

  return { orders, totalRevenue, count: orders.length };
}

module.exports = { getSummary, getDetailedReport, getNetProfitSince };
