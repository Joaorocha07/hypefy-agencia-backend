const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const lgpdService = require('../services/lgpd.service');

const createRequest = asyncHandler(async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  const result = await lgpdService.createRequest({ ...req.body, ip });
  success(res, result, 'Solicitação recebida com sucesso. Responderemos em até 15 dias corridos.', 201);
});

module.exports = { createRequest };
