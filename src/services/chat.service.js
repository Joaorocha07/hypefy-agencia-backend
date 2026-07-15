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

  const messages = await prisma.chatMessage.findMany({ where, orderBy: { createdAt: 'asc' } });

  // Viewing the chat marks the other side's messages as read — customer reads
  // seller/system replies, staff reads the customer's messages. staffLastReadAt
  // is shared across all ADM/FUNC: whoever opens the chat marks it read for the team.
  if (requester.role === 'USER') {
    await prisma.order.update({ where: { id: orderId }, data: { customerLastReadAt: new Date() } });
  } else if (requester.role === 'ADM' || requester.role === 'FUNC') {
    await prisma.order.update({ where: { id: orderId }, data: { staffLastReadAt: new Date() } });
  }

  return messages;
}

function classifyMessage(message) {
  if (message.isDelivery) return 'delivery';
  if (message.sender === 'SYSTEM') {
    return message.message.startsWith('Pagamento confirmado') ? 'payment_confirmed' : 'system';
  }
  return 'chat_message';
}

// One notification per order (its most recent seller/system message), whether
// already read or not — read items stay visible (dimmed) instead of disappearing,
// since there's no per-message read tracking, only a per-order cutoff.
async function getNotificationsForUser(userId, limit = 20) {
  const orders = await prisma.order.findMany({
    where: { userId },
    select: { id: true, customerLastReadAt: true, product: { select: { title: true } } },
  });

  const items = await Promise.all(
    orders.map(async (order) => {
      const latestMessage = await prisma.chatMessage.findFirst({
        where: { orderId: order.id, sender: { not: 'USER' } },
        orderBy: { createdAt: 'desc' },
      });
      if (!latestMessage) return null;

      const isUnread = !order.customerLastReadAt || latestMessage.createdAt > order.customerLastReadAt;
      const unreadCount = isUnread
        ? await prisma.chatMessage.count({
            where: {
              orderId: order.id,
              sender: { not: 'USER' },
              ...(order.customerLastReadAt && { createdAt: { gt: order.customerLastReadAt } }),
            },
          })
        : 0;

      return {
        orderId: order.id,
        productTitle: order.product.title,
        type: classifyMessage(latestMessage),
        message: latestMessage.isDelivery ? '🎁 Seu produto está pronto!' : latestMessage.message,
        isUnread,
        unreadCount,
        createdAt: latestMessage.createdAt,
      };
    })
  );

  return items
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function getUnreadCountForUser(userId) {
  const notifications = await getNotificationsForUser(userId, 100);
  return notifications.reduce((sum, item) => sum + item.unreadCount, 0);
}

async function markOrderRead(orderId, requester) {
  await getOrderForAccess(orderId, requester);
  if (requester.role === 'USER') {
    await prisma.order.update({ where: { id: orderId }, data: { customerLastReadAt: new Date() } });
  } else if (requester.role === 'ADM' || requester.role === 'FUNC') {
    await prisma.order.update({ where: { id: orderId }, data: { staffLastReadAt: new Date() } });
  }
}

async function markAllRead(userId) {
  await prisma.order.updateMany({ where: { userId }, data: { customerLastReadAt: new Date() } });
}

// Global across all orders (staff can access any order, they don't "own" any) —
// the most recent customer message per order, whether already read or not.
async function getStaffNotifications(limit = 20) {
  const orders = await prisma.order.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      staffLastReadAt: true,
      product: { select: { title: true } },
      user: { select: { name: true, email: true } },
    },
  });

  const items = await Promise.all(
    orders.map(async (order) => {
      const latestMessage = await prisma.chatMessage.findFirst({
        where: { orderId: order.id, sender: 'USER' },
        orderBy: { createdAt: 'desc' },
      });
      if (!latestMessage) return null;

      const isUnread = !order.staffLastReadAt || latestMessage.createdAt > order.staffLastReadAt;
      const unreadCount = isUnread
        ? await prisma.chatMessage.count({
            where: {
              orderId: order.id,
              sender: 'USER',
              ...(order.staffLastReadAt && { createdAt: { gt: order.staffLastReadAt } }),
            },
          })
        : 0;

      return {
        orderId: order.id,
        productTitle: order.product.title,
        customerName: order.user.name || order.user.email,
        message: latestMessage.message,
        isUnread,
        unreadCount,
        createdAt: latestMessage.createdAt,
      };
    })
  );

  return items
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function getStaffUnreadCount() {
  const notifications = await getStaffNotifications(200);
  return notifications.reduce((sum, item) => sum + item.unreadCount, 0);
}

async function markAllReadByStaff() {
  await prisma.order.updateMany({ data: { staffLastReadAt: new Date() } });
}

async function sendMessage(orderId, requester, message) {
  await getOrderForAccess(orderId, requester);

  const sender = requester.role === 'USER' ? 'USER' : requester.role;

  return prisma.chatMessage.create({
    data: { orderId, sender, message, isDelivery: false },
  });
}

module.exports = {
  listMessages,
  sendMessage,
  getUnreadCountForUser,
  getNotificationsForUser,
  markOrderRead,
  markAllRead,
  getStaffNotifications,
  getStaffUnreadCount,
  markAllReadByStaff,
};
