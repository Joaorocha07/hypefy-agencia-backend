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
// A single query with LATERAL joins computes the latest message + unread count
// per order in the database — doing this per-order in JS (one findFirst + one
// count per order) turned every poll into an N+1 fan-out that got slow (and
// occasionally timed out) as orders piled up.
async function getNotificationsForUser(userId, limit = 20) {
  const rows = await prisma.$queryRaw`
    SELECT
      o.id AS "orderId",
      p.title AS "productTitle",
      latest.sender,
      latest.message,
      latest.is_delivery AS "isDelivery",
      latest.created_at AS "createdAt",
      COALESCE(unread.count, 0)::int AS "unreadCount"
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN LATERAL (
      SELECT sender, message, is_delivery, created_at
      FROM chat_messages
      WHERE order_id = o.id AND sender != 'USER'
      ORDER BY created_at DESC
      LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count
      FROM chat_messages cm
      WHERE cm.order_id = o.id AND cm.sender != 'USER'
        AND (o.customer_last_read_at IS NULL OR cm.created_at > o.customer_last_read_at)
    ) unread ON true
    WHERE o.user_id = ${userId}
    ORDER BY latest.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    orderId: row.orderId,
    productTitle: row.productTitle,
    type: classifyMessage(row),
    message: row.isDelivery ? '🎁 Seu produto está pronto!' : row.message,
    isUnread: row.unreadCount > 0,
    unreadCount: row.unreadCount,
    createdAt: row.createdAt,
  }));
}

async function getUnreadCountForUser(userId) {
  const [{ count }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM chat_messages cm
    JOIN orders o ON o.id = cm.order_id
    WHERE o.user_id = ${userId}
      AND cm.sender != 'USER'
      AND (o.customer_last_read_at IS NULL OR cm.created_at > o.customer_last_read_at)
  `;
  return count;
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
// Same LATERAL-join approach as getNotificationsForUser — computed in one query
// instead of fanning out a findFirst + count per order (up to 200 orders × 2
// queries every 20s poll, which is what made this slow/flaky before).
async function getStaffNotifications(limit = 20) {
  const rows = await prisma.$queryRaw`
    SELECT
      o.id AS "orderId",
      p.title AS "productTitle",
      u.name AS "userName",
      u.email AS "userEmail",
      latest.message,
      latest.created_at AS "createdAt",
      COALESCE(unread.count, 0)::int AS "unreadCount"
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN users u ON u.id = o.user_id
    JOIN LATERAL (
      SELECT message, created_at
      FROM chat_messages
      WHERE order_id = o.id AND sender = 'USER'
      ORDER BY created_at DESC
      LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count
      FROM chat_messages cm
      WHERE cm.order_id = o.id AND cm.sender = 'USER'
        AND (o.staff_last_read_at IS NULL OR cm.created_at > o.staff_last_read_at)
    ) unread ON true
    ORDER BY latest.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    orderId: row.orderId,
    productTitle: row.productTitle,
    customerName: row.userName || row.userEmail,
    message: row.message,
    isUnread: row.unreadCount > 0,
    unreadCount: row.unreadCount,
    createdAt: row.createdAt,
  }));
}

async function getStaffUnreadCount() {
  const [{ count }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM chat_messages cm
    JOIN orders o ON o.id = cm.order_id
    WHERE cm.sender = 'USER'
      AND (o.staff_last_read_at IS NULL OR cm.created_at > o.staff_last_read_at)
  `;
  return count;
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
