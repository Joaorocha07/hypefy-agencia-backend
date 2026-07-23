const prisma = require('../config/db');
const AppError = require('../utils/appError');

const PROTECTED_NAME = 'ENGAJAMENTO';

function serializeCategory(category) {
  const [latest] = category.products ?? [];
  return {
    id: category.id,
    name: category.name,
    order: category.order,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    productCount: category._count.products,
    latestProduct: latest ? { id: latest.id, title: latest.title } : null,
  };
}

async function listCategories() {
  const categories = await prisma.category.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { products: true } },
      products: { select: { id: true, title: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  return categories.map(serializeCategory);
}

async function getCategoryById(id) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new AppError('Categoria não encontrada', 404);
  return category;
}

async function createCategory({ name }) {
  const last = await prisma.category.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
  return prisma.category.create({ data: { name, order: (last?.order ?? -1) + 1 } });
}

/**
 * Bulk-updates the display order of categories. Ids not found are ignored by
 * updateMany (no-op) rather than throwing, so a stale client payload can't
 * fail the whole reorder — the UI just refetches and shows the real state.
 */
async function reorderCategories(items) {
  await prisma.$transaction(items.map(({ id, order }) => prisma.category.updateMany({ where: { id }, data: { order } })));
  return listCategories();
}

async function updateCategory(id, { name }) {
  const category = await getCategoryById(id);

  if (category.name === PROTECTED_NAME && name !== PROTECTED_NAME) {
    throw new AppError(
      `A categoria "${PROTECTED_NAME}" não pode ser renomeada: o fluxo de pedidos de engajamento depende deste nome`,
      409
    );
  }

  return prisma.category.update({ where: { id }, data: { name } });
}

async function deleteCategory(id) {
  await getCategoryById(id);

  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw new AppError(
      `Esta categoria possui ${productCount} produto${productCount === 1 ? '' : 's'} vinculado${productCount === 1 ? '' : 's'}. Mova-os para outra categoria antes de excluir.`,
      409
    );
  }

  return prisma.category.delete({ where: { id } });
}

module.exports = { listCategories, getCategoryById, createCategory, updateCategory, deleteCategory, reorderCategories };
