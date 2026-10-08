const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const guestOrderService = require('../services/guestOrder.service');

const create = asyncHandler(async (req, res) => {
  const result = await guestOrderService.createGuestOrder(req.body);
  success(res, result, 'Pedido criado', 201);
});

const status = asyncHandler(async (req, res) => {
  const order = await guestOrderService.getGuestOrderStatus(req.params.id, req.query.token);
  success(res, order);
});

module.exports = { create, status };
