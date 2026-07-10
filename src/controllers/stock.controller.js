const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const stockService = require('../services/stock.service');

const addItems = asyncHandler(async (req, res) => {
  const product = await stockService.addStockItems(req.params.productId, req.body.items);
  success(res, product, 'Itens de estoque adicionados com sucesso', 201);
});

const listItems = asyncHandler(async (req, res) => {
  const result = await stockService.listStockItems(req.params.productId, req.query);
  success(res, result);
});

const overview = asyncHandler(async (req, res) => {
  const result = await stockService.getStockOverview();
  success(res, result);
});

module.exports = { addItems, listItems, overview };
