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

module.exports = { listCustomers, getCustomerOrders };
