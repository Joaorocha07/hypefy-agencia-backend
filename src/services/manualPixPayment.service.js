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

// Mesmos campos que computeManualPixCost precisa.
const PRODUCT_COST_SELECT = {
  id: true,
  title: true,
  costPrice: true,
  manualCostPrice: true,
  profitMarginPercent: true,
  category: { select: { name: true } },
};

async function findProductOrThrow(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: PRODUCT_COST_SELECT });
  if (!product) throw new AppError('Produto não encontrado', 404);
  return product;
}

// Custo da agência nessa venda avulsa. Espelha computeOrderCost (order.service.js):
// ENGAJAMENTO deriva o custo da margem sobre o valor cobrado; os demais usam o
// custo manual, caindo pro costPrice quando não há custo manual cadastrado.
// Manual PIX é sempre quantidade 1.
function computeManualPixCost(product, amount) {
  if (!product) return 0;
  if (product.category?.name === 'ENGAJAMENTO') {
    const margin = Number(product.profitMarginPercent || 0);
    return Number(amount) / (1 + margin / 100);
  }
  return Number(product.manualCostPrice ?? product.costPrice ?? 0);
}

function costDescription(customerName, product) {
  return `Custo — ${customerName}${product ? ` (${product.title})` : ''}`;
}

async function createManualPixPayment(registeredById, data) {
  const { customerName, customerPhone, amount, productId, note } = data;

  const product = productId ? await findProductOrThrow(productId) : null;
  const cost = computeManualPixCost(product, amount);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: 'SALE',
        amount,
        description: `PIX externo — ${customerName}${product ? ` (${product.title})` : ''}`,
      },
    });

    let costTransactionId = null;
    if (cost > 0) {
      const costTransaction = await tx.transaction.create({
        data: { type: 'COST', amount: cost, description: costDescription(customerName, product) },
      });
      costTransactionId = costTransaction.id;
    }

    return tx.manualPixPayment.create({
      data: {
        customerName,
        customerPhone,
        amount,
        productId: productId ?? null,
        note: note ?? null,
        transactionId: transaction.id,
        costTransactionId,
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
  const nextCost = computeManualPixCost(product, nextAmount);

  return prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: existing.transactionId },
      data: {
        amount: nextAmount,
        description: `PIX externo — ${nextName}${product ? ` (${product.title})` : ''}`,
      },
    });

    // Mantém a Transaction COST em sincronia: cria se passou a ter custo, atualiza
    // se já existia, apaga se o produto foi removido ou o custo zerou.
    let costTransactionId = existing.costTransactionId;
    if (nextCost > 0) {
      if (existing.costTransactionId) {
        await tx.transaction.update({
          where: { id: existing.costTransactionId },
          data: { amount: nextCost, description: costDescription(nextName, product) },
        });
      } else {
        const costTransaction = await tx.transaction.create({
          data: { type: 'COST', amount: nextCost, description: costDescription(nextName, product) },
        });
        costTransactionId = costTransaction.id;
      }
    } else if (existing.costTransactionId) {
      await tx.transaction.delete({ where: { id: existing.costTransactionId } });
      costTransactionId = null;
    }

    return tx.manualPixPayment.update({
      where: { id },
      data: {
        ...(data.customerName !== undefined && { customerName: data.customerName }),
        ...(data.customerPhone !== undefined && { customerPhone: data.customerPhone }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.productId !== undefined && { productId: data.productId }),
        ...(data.note !== undefined && { note: data.note }),
        costTransactionId,
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
    ...(existing.costTransactionId
      ? [prisma.transaction.delete({ where: { id: existing.costTransactionId } })]
      : []),
  ]);
}

module.exports = { createManualPixPayment, listManualPixPayments, updateManualPixPayment, deleteManualPixPayment };
