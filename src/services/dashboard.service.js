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

  const [paidOrders, manualPixPayments] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: 'PAID', createdAt: { gte: startDate } },
      select: { id: true, totalPrice: true },
    }),
    // PIX pago fora do site (ver manualPixPayment.service.js) — soma junto pra
    // "Total vendido"/"Nº de pedidos"/"Ticket médio" refletirem todas as vendas,
    // não só as feitas pelo checkout. A receita (Transaction SALE) já é somada
    // à parte por getNetProfitSince, que roda por baixo dos panos aqui embaixo.
    prisma.manualPixPayment.findMany({
      where: { createdAt: { gte: startDate } },
      select: { id: true, amount: true },
    }),
  ]);

  const totalSales =
    paidOrders.reduce((acc, o) => acc + Number(o.totalPrice), 0) +
    manualPixPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const orderCount = paidOrders.length + manualPixPayments.length;
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

  const dateWhere = {
    ...(effectiveStartDate && { createdAt: { gte: effectiveStartDate } }),
    ...(endDate && {
      createdAt: { ...(effectiveStartDate && { gte: effectiveStartDate }), lte: new Date(endDate) },
    }),
  };

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: 'PAID',
      ...dateWhere,
      ...(productId && { productId }),
      ...(userId && { userId }),
    },
    include: {
      product: { select: { title: true, category: { select: { name: true } }, platform: { select: { name: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const orderRows = orders.map((o) => ({
    id: o.id,
    createdAt: o.createdAt,
    quantity: o.quantity,
    totalPrice: o.totalPrice,
    orderStatus: o.orderStatus,
    isManual: false,
    product: o.product,
    customerName: o.user.name ?? o.user.email,
    customerContact: o.user.email,
  }));

  // PIX pago fora do site (ver manualPixPayment.service.js) — sem userId (não é
  // cliente com conta no site), então só entra no relatório quando o filtro não
  // é o histórico de um cliente específico.
  let manualRows = [];
  if (!userId) {
    const manualPayments = await prisma.manualPixPayment.findMany({
      where: { ...dateWhere, ...(productId && { productId }) },
      include: {
        product: { select: { title: true, category: { select: { name: true } }, platform: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    manualRows = manualPayments.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      quantity: 1,
      totalPrice: p.amount,
      orderStatus: null,
      isManual: true,
      product: p.product,
      customerName: p.customerName,
      customerContact: p.customerPhone,
    }));
  }

  const rows = [...orderRows, ...manualRows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalRevenue = rows.reduce((acc, r) => acc + Number(r.totalPrice), 0);

  return { orders: rows, totalRevenue, count: rows.length };
}

module.exports = { getSummary, getDetailedReport, getNetProfitSince };
