const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const chatService = require('../services/chat.service');

const list = asyncHandler(async (req, res) => {
  const messages = await chatService.listMessages(req.params.orderId, req.user);
  success(res, messages);
});

const send = asyncHandler(async (req, res) => {
  const message = await chatService.sendMessage(req.params.orderId, req.user, req.body.message);
  success(res, message, 'Mensagem enviada', 201);
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await chatService.getUnreadCountForUser(req.user.id);
  success(res, { count });
});

const notifications = asyncHandler(async (req, res) => {
  const items = await chatService.getNotificationsForUser(req.user.id);
  success(res, items);
});

const markRead = asyncHandler(async (req, res) => {
  await chatService.markOrderRead(req.params.orderId, req.user);
  success(res, null, 'Marcado como lido');
});

const markAllRead = asyncHandler(async (req, res) => {
  await chatService.markAllRead(req.user.id);
  success(res, null, 'Todas as notificações marcadas como lidas');
});

const staffNotifications = asyncHandler(async (req, res) => {
  const items = await chatService.getStaffNotifications();
  success(res, items);
});

const staffUnreadCount = asyncHandler(async (req, res) => {
  const count = await chatService.getStaffUnreadCount();
  success(res, { count });
});

const staffMarkAllRead = asyncHandler(async (req, res) => {
  await chatService.markAllReadByStaff();
  success(res, null, 'Todas as notificações marcadas como lidas');
});

module.exports = {
  list,
  send,
  unreadCount,
  notifications,
  markRead,
  markAllRead,
  staffNotifications,
  staffUnreadCount,
  staffMarkAllRead,
};
