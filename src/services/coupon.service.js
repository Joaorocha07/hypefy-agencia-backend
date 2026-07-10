const prisma = require('../config/db');
const AppError = require('../utils/appError');

async function createCoupon(createdBy, data) {
  const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
  if (existing) throw new AppError('Já existe um cupom com este código', 409);

  return prisma.coupon.create({ data: { ...data, createdBy } });
}

async function listCoupons({ isActive } = {}) {
  const where = isActive !== undefined ? { isActive } : {};
  return prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' } });
}

async function updateCoupon(id, data) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new AppError('Cupom não encontrado', 404);
  return prisma.coupon.update({ where: { id }, data });
}

async function deactivateCoupon(id) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new AppError('Cupom não encontrado', 404);
  return prisma.coupon.update({ where: { id }, data: { isActive: false } });
}

// Valida o cupom e retorna o valor de desconto aplicável para o subtotal informado.
// Não incrementa uses_count aqui — isso é feito ao confirmar o pagamento (para não "gastar" o uso em pedidos nunca pagos).
async function validateCoupon(code, subtotal) {
  if (!code) return { discountAmount: 0, coupon: null };

  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) throw new AppError('Cupom inválido ou inativo', 422);

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) throw new AppError('Cupom ainda não é válido', 422);
  if (coupon.validUntil && now > coupon.validUntil) throw new AppError('Cupom expirado', 422);
  if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses) {
    throw new AppError('Cupom atingiu o limite de usos', 422);
  }

  const discountAmount =
    coupon.discountType === 'PERCENTAGE'
      ? (Number(subtotal) * Number(coupon.discountValue)) / 100
      : Math.min(Number(coupon.discountValue), Number(subtotal));

  return { discountAmount, coupon };
}

async function registerCouponUse(couponId) {
  await prisma.coupon.update({ where: { id: couponId }, data: { usesCount: { increment: 1 } } });
}

module.exports = {
  createCoupon,
  listCoupons,
  updateCoupon,
  deactivateCoupon,
  validateCoupon,
  registerCouponUse,
};
