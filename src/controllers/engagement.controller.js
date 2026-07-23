const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const engagementService = require('../services/engagement.service');

const listServices = asyncHandler(async (req, res) => {
  const services = await engagementService.getExternalServices({
    forceRefresh: req.query.refresh === 'true',
  });
  success(res, engagementService.hideRateIfFunc(req.user.role, services));
});

const balance = asyncHandler(async (req, res) => {
  const result = await engagementService.getBalance();
  success(res, result);
});

const setMargin = asyncHandler(async (req, res) => {
  const product = await engagementService.setProductMargin(req.params.productId, req.body);
  success(res, product, 'Margem de lucro configurada com sucesso');
});

const refill = asyncHandler(async (req, res) => {
  const result = await engagementService.requestRefill(req.params.orderId);
  success(res, result, 'Reposição solicitada');
});

const cancel = asyncHandler(async (req, res) => {
  const result = await engagementService.cancelExternalOrder(req.params.orderId);
  success(res, result, 'Cancelamento solicitado');
});

module.exports = { listServices, balance, setMargin, refill, cancel };
