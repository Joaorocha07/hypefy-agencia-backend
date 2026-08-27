const prisma = require('../config/db');
const AppError = require('../utils/appError');

const LIST_SELECT = {
  id: true,
  customerName: true,
  customerPhone: true,
  amount: true,
  note: true,
  productId: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      title: true,
      imageUrl: true,
      price: true,
      category: { select: { name: true } },
      platform: { select: { name: true } },
    },
  },
  registeredBy: { select: { id: true, name: true, email: true } },
};

async function findProductOrThrow(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true } });
  if (!product) throw new AppError('Produto não encontrado', 404);
  return product;
}

async function createManualPixPayment(registeredById, data) {
  const { customerName, customerPhone, amount, productId, note } = data;

  const product = productId ? await findProductOrThrow(productId) : null;

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: 'SALE',
        amount,
        description: `PIX externo — ${customerName}${product ? ` (${product.title})` : ''}`,
      },
    });

    return tx.manualPixPayment.create({
      data: {
        customerName,
        customerPhone,
        amount,
        productId: productId ?? null,
        note: note ?? null,
        transactionId: transaction.id,
        registeredById,
      },
      select: LIST_SELECT,
    });
  });
}

async function listManualPixPayments({ page = 1, limit = 20, productId, startDate, endDate } = {}) {
  const where = {
    ...(productId && { productId }),
    ...((startDate || endDate) && {
      createdAt: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      },
    }),
  };

  const [items, total, totalAmountAgg] = await Promise.all([
    prisma.manualPixPayment.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.manualPixPayment.count({ where }),
    prisma.manualPixPayment.aggregate({ where, _sum: { amount: true } }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    totalAmount: Number(totalAmountAgg._sum.amount || 0),
  };
}

async function updateManualPixPayment(id, data) {
  const existing = await prisma.manualPixPayment.findUnique({ where: { id } });
  if (!existing) throw new AppError('Pagamento não encontrado', 404);

  const nextProductId = data.productId !== undefined ? data.productId : existing.productId;
  const product = nextProductId ? await findProductOrThrow(nextProductId) : null;

  const nextName = data.customerName ?? existing.customerName;
  const nextAmount = data.amount ?? Number(existing.amount);

  return prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: existing.transactionId },
      data: {
        amount: nextAmount,
        description: `PIX externo — ${nextName}${product ? ` (${product.title})` : ''}`,
      },
    });

    return tx.manualPixPayment.update({
      where: { id },
      data: {
        ...(data.customerName !== undefined && { customerName: data.customerName }),
        ...(data.customerPhone !== undefined && { customerPhone: data.customerPhone }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.productId !== undefined && { productId: data.productId }),
        ...(data.note !== undefined && { note: data.note }),
      },
      select: LIST_SELECT,
    });
  });
}

async function deleteManualPixPayment(id) {
  const existing = await prisma.manualPixPayment.findUnique({ where: { id } });
  if (!existing) throw new AppError('Pagamento não encontrado', 404);

  await prisma.$transaction([
    prisma.manualPixPayment.delete({ where: { id } }),
    prisma.transaction.delete({ where: { id: existing.transactionId } }),
  ]);
}

module.exports = { createManualPixPayment, listManualPixPayments, updateManualPixPayment, deleteManualPixPayment };
