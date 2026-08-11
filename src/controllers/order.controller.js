const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const orderService = require('../services/order.service');

const create = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.user.id, req.body);
  success(res, order, 'Pedido criado — aguardando pagamento via PIX', 201);
});

const myOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listUserOrders(req.user.id, req.query);
  success(res, result);
});

const myOrderDetail = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderForUser(req.params.id, req.user.id);
  success(res, order);
});

const listAdmin = asyncHandler(async (req, res) => {
  const result = await orderService.listAllOrders(req.query);
  success(res, result);
});

const getAdmin = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderAdmin(req.params.id);
  success(res, order);
});

const completeManually = asyncHandler(async (req, res) => {
  const order = await orderService.markOrderCompletedManually(req.params.id);
  success(res, order, 'Pedido marcado como concluído manualmente');
});

const adminEngagementStatus = asyncHandler(async (req, res) => {
  const status = await orderService.getEngagementStatusForOrderAdmin(req.params.id);
  success(res, status);
});

const setManualStartCount = asyncHandler(async (req, res) => {
  const order = await orderService.setManualEngagementStartCount(req.params.id, String(req.body.startCount));
  success(res, order, 'Contagem inicial registrada');
});

const myEngagementStatus = asyncHandler(async (req, res) => {
  const status = await orderService.getEngagementStatusForOrder(req.params.id, req.user.id);
  success(res, status);
});

module.exports = {
  create,
  myOrders,
  myOrderDetail,
  myEngagementStatus,
  listAdmin,
  getAdmin,
  completeManually,
  adminEngagementStatus,
  setManualStartCount,
};
