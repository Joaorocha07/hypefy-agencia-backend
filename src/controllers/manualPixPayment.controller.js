const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const service = require('../services/manualPixPayment.service');

const create = asyncHandler(async (req, res) => {
  const payment = await service.createManualPixPayment(req.user.id, req.body);
  success(res, payment, 'Pagamento PIX registrado', 201);
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listManualPixPayments(req.query);
  success(res, result);
});

const update = asyncHandler(async (req, res) => {
  const payment = await service.updateManualPixPayment(req.params.id, req.body);
  success(res, payment, 'Pagamento atualizado');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteManualPixPayment(req.params.id);
  success(res, null, 'Pagamento removido');
});

module.exports = { create, list, update, remove };
