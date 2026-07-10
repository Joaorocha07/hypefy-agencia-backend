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

module.exports = { list, send };
