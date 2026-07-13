const prisma = require('../config/db');
const AppError = require('../utils/appError');
const storageService = require('./storage.service');

const PRICE_FIELDS = ['price', 'costPrice', 'profitMarginPercent'];
const FINANCIAL_FIELDS = ['costPrice', 'profitMarginPercent'];

const CATEGORY_PLATFORM_SELECT = {
  category: { select: { id: true, name: true } },
  platform: { select: { id: true, name: true, logoUrl: true, color: true } },
};

const PUBLIC_SELECT = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  price: true,
  stockQuantity: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  ...CATEGORY_PLATFORM_SELECT,
};

function stripPriceFieldsIfFunc(role, data) {
  if (role === 'FUNC') {
    const clean = { ...data };
    PRICE_FIELDS.forEach((field) => delete clean[field]);
    return clean;
  }
  return data;
}

function hideFinancialFieldsIfFunc(role, product) {
  if (role !== 'FUNC' || !product) return product;
  const clean = { ...product };
  FINANCIAL_FIELDS.forEach((field) => delete clean[field]);
  return clean;
}

async function listProducts({ categoryId, platformId, isActive, search, page = 1, limit = 20 }, role = 'ADM') {
  const where = {
    ...(categoryId && { categoryId }),
    ...(platformId && { platformId }),
    ...(isActive !== undefined && { isActive }),
    ...(search && { title: { contains: search, mode: 'insensitive' } }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: CATEGORY_PLATFORM_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map((p) => hideFinancialFieldsIfFunc(role, p)),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

async function listPublicProducts(filters) {
  const { categoryId, platformId, search, page = 1, limit = 20 } = filters;
  const where = {
    isActive: true,
    ...(categoryId && { categoryId }),
    ...(platformId && { platformId }),
    ...(search && { title: { contains: search, mode: 'insensitive' } }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getPublicProductById(id) {
  const product = await prisma.product.findFirst({ where: { id, isActive: true }, select: PUBLIC_SELECT });
  if (!product) throw new AppError('Produto não encontrado', 404);
  return product;
}

async function getProductById(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: CATEGORY_PLATFORM_SELECT });
  if (!product) throw new AppError('Produto não encontrado', 404);
  return product;
}

async function getProductByIdForRole(id, role) {
  const product = await getProductById(id);
  return hideFinancialFieldsIfFunc(role, product);
}

async function createProduct(role, data, file) {
  const payload = stripPriceFieldsIfFunc(role, data);

  let imageUrl;
  if (file) {
    const uploaded = await storageService.uploadImage(file);
    imageUrl = uploaded.url;
  }

  const created = await prisma.product.create({
    data: {
      title: payload.title,
      description: payload.description,
      price: payload.price ?? 0,
      costPrice: payload.costPrice,
      stockQuantity: payload.stockQuantity ?? 0,
      categoryId: payload.categoryId,
      platformId: payload.platformId,
      baratosSociaisServiceId: payload.baratosSociaisServiceId,
      profitMarginPercent: payload.profitMarginPercent ?? 0,
      imageUrl,
    },
    include: CATEGORY_PLATFORM_SELECT,
  });

  return hideFinancialFieldsIfFunc(role, created);
}

async function updateProduct(role, id, data, file) {
  const product = await getProductById(id);
  const payload = stripPriceFieldsIfFunc(role, data);

  let imageUrl = product.imageUrl;
  if (file) {
    const uploaded = await storageService.uploadImage(file);
    if (product.imageUrl) await storageService.deleteImage(product.imageUrl);
    imageUrl = uploaded.url;
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { ...payload, imageUrl },
    include: CATEGORY_PLATFORM_SELECT,
  });

  return hideFinancialFieldsIfFunc(role, updated);
}

async function setActive(id, isActive) {
  await getProductById(id);
  return prisma.product.update({ where: { id }, data: { isActive }, include: CATEGORY_PLATFORM_SELECT });
}

async function deleteProduct(id) {
  await getProductById(id);

  const [stockCount, orderCount] = await Promise.all([
    prisma.stockItem.count({ where: { productId: id } }),
    prisma.order.count({ where: { productId: id } }),
  ]);

  if (stockCount > 0 || orderCount > 0) {
    throw new AppError(
      'Não é possível excluir este produto: existem itens de estoque ou pedidos vinculados a ele. Inative o produto em vez de excluí-lo.',
      409
    );
  }

  await prisma.product.delete({ where: { id } });
}

module.exports = {
  listProducts,
  listPublicProducts,
  getPublicProductById,
  getProductById,
  getProductByIdForRole,
  createProduct,
  updateProduct,
  setActive,
  deleteProduct,
};
