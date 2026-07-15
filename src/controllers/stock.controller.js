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

const listAccounts = asyncHandler(async (req, res) => {
  const result = await stockService.listStockAccounts(req.params.productId, req.query);
  success(res, result);
});

const overview = asyncHandler(async (req, res) => {
  const result = await stockService.getStockOverview();
  success(res, result);
});

const updateItem = asyncHandler(async (req, res) => {
  const result = await stockService.updateStockItemContent(req.params.itemId, req.body.content, req.user.id);
  success(res, result, 'Credenciais atualizadas com sucesso');
});

const getCustomers = asyncHandler(async (req, res) => {
  const customers = await stockService.getAccountCustomers(req.params.itemId);
  success(res, customers);
});

const notifyAccessUpdate = asyncHandler(async (req, res) => {
  const result = await stockService.notifyAccessUpdate(
    req.params.productId,
    req.body.content,
    req.user.id,
    req.body.orderIds
  );
  success(res, result, 'Clientes notificados com sucesso');
});

const previewNotifyRecipients = asyncHandler(async (req, res) => {
  const recipients = await stockService.previewAccessUpdateRecipients(req.params.productId);
  success(res, recipients);
});

const accessLog = asyncHandler(async (req, res) => {
  const entries = await stockService.getAccessUpdateLog(req.params.productId);
  success(res, entries);
});

module.exports = {
  addItems,
  listItems,
  listAccounts,
  overview,
  updateItem,
  getCustomers,
  notifyAccessUpdate,
  previewNotifyRecipients,
  accessLog,
};
