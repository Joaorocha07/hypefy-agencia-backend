const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const customerService = require('../services/customer.service');

const list = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomers(req.query);
  success(res, result);
});

const getOrders = asyncHandler(async (req, res) => {
  const result = await customerService.getCustomerOrders(req.params.id);
  success(res, result);
});

module.exports = { list, getOrders };
