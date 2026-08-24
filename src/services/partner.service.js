const prisma = require('../config/db');
const AppError = require('../utils/appError');
const { ADMIN_MENUS } = require('../utils/menus');
const dashboardService = require('./dashboard.service');

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  isActive: true,
  allowedMenus: true,
  financialVisibleFrom: true,
  profitSharePercent: true,
  createdAt: true,
  updatedAt: true,
};

function validateAllowedMenus(allowedMenus) {
  if (allowedMenus && allowedMenus.some((menu) => !ADMIN_MENUS.includes(menu))) {
    throw new AppError('Menu inválido em allowedMenus', 422);
  }
}

// Reaproveita a conta existente do cliente (login/senha, histórico de pedidos)
// em vez de criar um sócio do zero — a pessoa já se cadastrou como cliente
// normalmente, o admin master só busca e promove. Mesmo padrão de
// customer.service.js#promoteToEmployee, com as permissões de sócio já
// definidas no ato da promoção.
async function promotePartner(customerId, { allowedMenus, financialVisibleFrom, profitSharePercent } = {}) {
  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError('Cliente não encontrado', 404);
  if (customer.role !== 'USER') {
    throw new AppError('Este usuário já não é mais um cliente comum', 409);
  }

  validateAllowedMenus(allowedMenus);

  return prisma.user.update({
    where: { id: customerId },
    data: {
      role: 'SOCIO',
      allowedMenus: allowedMenus ?? [],
      financialVisibleFrom: financialVisibleFrom ?? null,
      profitSharePercent: profitSharePercent ?? 0,
    },
    select: SAFE_SELECT,
  });
}

// payoutAmount = % do lucro líquido acumulado desde financialVisibleFrom (ou
// desde sempre, se não houver corte) — não é um valor "a pagar" com controle de
// já-pago; o admin master reajusta financialVisibleFrom após cada repasse para
// zerar a base de cálculo do próximo período.
async function withPayout(partner) {
  const { netProfit } = await dashboardService.getNetProfitSince(partner.financialVisibleFrom);
  const payoutAmount = netProfit * (Number(partner.profitSharePercent) / 100);
  return { ...partner, netProfitSincePayout: netProfit, payoutAmount };
}

async function listPartners({ isActive } = {}) {
  const where = { role: 'SOCIO', ...(isActive !== undefined && { isActive }) };
  const partners = await prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: { createdAt: 'desc' } });
  return Promise.all(partners.map(withPayout));
}

async function setPartnerActive(id, isActive) {
  const partner = await prisma.user.findFirst({ where: { id, role: 'SOCIO' } });
  if (!partner) throw new AppError('Sócio não encontrado', 404);

  return prisma.user.update({ where: { id }, data: { isActive }, select: SAFE_SELECT });
}

async function updatePartnerPermissions(id, { allowedMenus, financialVisibleFrom, profitSharePercent }) {
  const partner = await prisma.user.findFirst({ where: { id, role: 'SOCIO' } });
  if (!partner) throw new AppError('Sócio não encontrado', 404);

  validateAllowedMenus(allowedMenus);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(allowedMenus !== undefined && { allowedMenus }),
      ...(financialVisibleFrom !== undefined && { financialVisibleFrom }),
      ...(profitSharePercent !== undefined && { profitSharePercent }),
    },
    select: SAFE_SELECT,
  });

  return withPayout(updated);
}

module.exports = { promotePartner, listPartners, setPartnerActive, updatePartnerPermissions };
