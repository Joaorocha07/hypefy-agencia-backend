const prisma = require('../config/db');
const AppError = require('../utils/appError');
const storageService = require('./storage.service');
const engagementService = require('./engagement.service');

const PRICE_FIELDS = ['price', 'costPrice', 'profitMarginPercent'];
const FINANCIAL_FIELDS = ['costPrice', 'profitMarginPercent'];

// stockQuantity is never client-writable — it's derived from real StockItem
// rows (see stock.service.js#syncProductStockQuantity) so it can't drift from
// what's actually in stock. Accepting it from a form field was the original
// bug: an admin editing a product could silently overwrite the true count.
function stripStockQuantity(data) {
  const clean = { ...data };
  delete clean.stockQuantity;
  return clean;
}

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
  isFeatured: true,
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

async function listProducts(
  { categoryId, platformId, isActive, isFeatured, search, page = 1, limit = 20 },
  role = 'ADM'
) {
  const where = {
    ...(categoryId && { categoryId }),
    ...(platformId && { platformId }),
    ...(isActive !== undefined && { isActive }),
    ...(isFeatured !== undefined && { isFeatured }),
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
      // Produtos em destaque (isFeatured, controlado pelo ADM/FUNC) sempre primeiro.
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
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

/**
 * Public price preview for a given quantity — mirrors order.service#computePricing's
 * formula so what the customer sees before paying matches what they're actually
 * charged. `totalPrice`/`unitPrice` are always computed proportionally (rate is
 * per 1000, so 1 unit is rate/1000 × margin, not the full 1000-unit price) —
 * `valid` only says whether this quantity is inside the service's min/max and can
 * actually be ordered; it never nulls out the price, so the storefront can keep
 * showing an honest per-unit estimate while separately blocking checkout with the
 * min/max guidance.
 */
async function getPublicQuote(id, quantity) {
  const product = await prisma.product.findFirst({ where: { id, isActive: true }, include: { category: true } });
  if (!product) throw new AppError('Produto não encontrado', 404);

  if (product.category.name !== 'ENGAJAMENTO') {
    return { unitPrice: Number(product.price), totalPrice: Number(product.price) * quantity, min: 1, max: null, valid: true };
  }

  const services = await engagementService.getExternalServices();
  const external = Array.isArray(services)
    ? services.find((s) => String(s.service) === String(product.baratosSociaisServiceId))
    : null;
  if (!external) throw new AppError('Serviço de engajamento indisponível no momento', 503);

  const min = Number(external.min);
  const max = Number(external.max);
  const valid = quantity >= min && quantity <= max;
  const totalPrice = engagementService.computeSellPrice(external.rate, quantity, product.profitMarginPercent);

  return { unitPrice: totalPrice / quantity, totalPrice, min, max, valid };
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
  const payload = stripStockQuantity(stripPriceFieldsIfFunc(role, data));

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
      // Real stock is added via the Estoque screen (stock.service#addStockItems),
      // which is what actually keeps this number correct.
      stockQuantity: 0,
      accessDurationDays: payload.accessDurationDays ?? null,
      categoryId: payload.categoryId,
      platformId: payload.platformId,
      baratosSociaisServiceId: payload.baratosSociaisServiceId,
      profitMarginPercent: payload.profitMarginPercent ?? 0,
      isFeatured: payload.isFeatured ?? false,
      imageUrl,
    },
    include: CATEGORY_PLATFORM_SELECT,
  });

  return hideFinancialFieldsIfFunc(role, created);
}

async function updateProduct(role, id, data, file) {
  const product = await getProductById(id);
  const payload = stripStockQuantity(stripPriceFieldsIfFunc(role, data));

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

async function setFeatured(id, isFeatured) {
  await getProductById(id);
  return prisma.product.update({ where: { id }, data: { isFeatured }, include: CATEGORY_PLATFORM_SELECT });
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
  getPublicQuote,
  getProductById,
  getProductByIdForRole,
  createProduct,
  updateProduct,
  setActive,
  setFeatured,
  deleteProduct,
};
