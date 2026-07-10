const prisma = require('../config/db');
const AppError = require('../utils/appError');

async function getOrderForAccess(orderId, requester) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError('Pedido não encontrado', 404);

  if (requester.role === 'USER' && order.userId !== requester.id) {
    throw new AppError('Acesso negado a este pedido', 403);
  }

  return order;
}

async function listMessages(orderId, requester) {
  const order = await getOrderForAccess(orderId, requester);

  const where = {
    orderId,
    ...(order.paymentStatus !== 'PAID' && { isDelivery: false }),
  };

  return prisma.chatMessage.findMany({ where, orderBy: { createdAt: 'asc' } });
}

async function sendMessage(orderId, requester, message) {
  await getOrderForAccess(orderId, requester);

  const sender = requester.role === 'USER' ? 'USER' : requester.role;

  return prisma.chatMessage.create({
    data: { orderId, sender, message, isDelivery: false },
  });
}

module.exports = { listMessages, sendMessage };
