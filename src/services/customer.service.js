const prisma = require('../config/db');
const AppError = require('../utils/appError');

async function listCustomers({ search, page = 1, limit = 20 }) {
  const where = {
    role: 'USER',
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: users, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getCustomerOrders(customerId) {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: 'USER' },
    select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true },
  });
  if (!customer) throw new AppError('Cliente não encontrado', 404);

  const orders = await prisma.order.findMany({
    where: { userId: customerId },
    include: { product: { select: { id: true, title: true, category: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return { customer, orders };
}

// Reaproveita a conta existente (login/senha, histórico de pedidos) em vez de
// criar um funcionário do zero — só muda o role, então o cliente vira FUNC sem
// perder nada do que já tinha como usuário.
async function promoteToEmployee(customerId) {
  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError('Cliente não encontrado', 404);
  if (customer.role !== 'USER') {
    throw new AppError('Este usuário já não é mais um cliente comum', 409);
  }

  const promoted = await prisma.user.update({
    where: { id: customerId },
    data: { role: 'FUNC' },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
  });

  return promoted;
}

module.exports = { listCustomers, getCustomerOrders, promoteToEmployee };
