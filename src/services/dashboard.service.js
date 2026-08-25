const prisma = require('../config/db');

// BRT = UTC-3 permanente desde abril/2019 (horário de verão abolido).
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;

// Meia-noite de (y, m, d) em BRT equivale a 03:00 UTC do mesmo dia.
function midnightBR(y, m, d) {
  return new Date(Date.UTC(y, m, d, 3, 0, 0));
}

function periodStartDate(period) {
  // Desloca "agora" 3h para trás para obter a data-calendário correta em BRT.
  const brNow = new Date(Date.now() - BR_OFFSET_MS);
  const y = brNow.getUTCFullYear();
  const m = brNow.getUTCMonth();
  const d = brNow.getUTCDate();

  switch (period) {
    case 'day':
      return midnightBR(y, m, d);
    case 'week': {
      const dow = brNow.getUTCDay(); // 0 = domingo
      return new Date(midnightBR(y, m, d).getTime() - dow * 86_400_000);
    }
    case 'month':
      return midnightBR(y, m, 1);
    case 'year':
      return midnightBR(y, 0, 1);
    default:
      return midnightBR(y, m, 1);
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
