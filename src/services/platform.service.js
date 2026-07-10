const prisma = require('../config/db');
const AppError = require('../utils/appError');
const storageService = require('./storage.service');

function serializePlatform(platform) {
  const [latest] = platform.products ?? [];
  return {
    id: platform.id,
    name: platform.name,
    logoUrl: platform.logoUrl,
    color: platform.color,
    createdAt: platform.createdAt,
    updatedAt: platform.updatedAt,
    productCount: platform._count.products,
    latestProduct: latest ? { id: latest.id, title: latest.title } : null,
  };
}

async function listPlatforms() {
  const platforms = await prisma.platform.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: true } },
      products: { select: { id: true, title: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  return platforms.map(serializePlatform);
}

async function getPlatformById(id) {
  const platform = await prisma.platform.findUnique({ where: { id } });
  if (!platform) throw new AppError('Plataforma não encontrada', 404);
  return platform;
}

async function createPlatform({ name, color }, file) {
  let logoUrl;
  if (file) {
    const uploaded = await storageService.uploadImage(file, 'platforms');
    logoUrl = uploaded.url;
  }
  return prisma.platform.create({ data: { name, color, logoUrl } });
}

async function updatePlatform(id, { name, color }, file) {
  const platform = await getPlatformById(id);

  let logoUrl = platform.logoUrl;
  if (file) {
    const uploaded = await storageService.uploadImage(file, 'platforms');
    if (platform.logoUrl) await storageService.deleteImage(platform.logoUrl);
    logoUrl = uploaded.url;
  }

  return prisma.platform.update({ where: { id }, data: { name, color, logoUrl } });
}

async function deletePlatform(id) {
  const platform = await getPlatformById(id);

  const productCount = await prisma.product.count({ where: { platformId: id } });
  if (productCount > 0) {
    throw new AppError(
      `Esta plataforma possui ${productCount} produto${productCount === 1 ? '' : 's'} vinculado${productCount === 1 ? '' : 's'}. Mova-os para outra plataforma antes de excluir.`,
      409
    );
  }

  if (platform.logoUrl) await storageService.deleteImage(platform.logoUrl);
  return prisma.platform.delete({ where: { id } });
}

module.exports = { listPlatforms, getPlatformById, createPlatform, updatePlatform, deletePlatform };
