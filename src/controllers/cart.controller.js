const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const cartService = require('../services/cart.service');

const quote = asyncHandler(async (req, res) => {
  const result = await cartService.getCartQuote(req.body.items, req.body.couponCode);
  success(res, result);
});

const checkout = asyncHandler(async (req, res) => {
  const cartOrder = await cartService.createCartOrder(req.user.id, req.body);
  success(res, cartOrder, 'Carrinho finalizado', 201);
});

const getOne = asyncHandler(async (req, res) => {
  const cartOrder = await cartService.getCartOrderForUser(req.params.id, req.user.id);
  success(res, cartOrder);
});

module.exports = { quote, checkout, getOne };
