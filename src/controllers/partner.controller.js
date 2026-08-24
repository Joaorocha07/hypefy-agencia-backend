const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const partnerService = require('../services/partner.service');

const promote = asyncHandler(async (req, res) => {
  const { customerId, ...permissions } = req.body;
  const partner = await partnerService.promotePartner(customerId, permissions);
  success(res, partner, 'Cliente promovido a sócio com sucesso', 201);
});

const list = asyncHandler(async (req, res) => {
  const partners = await partnerService.listPartners(req.query);
  success(res, partners);
});

const setActive = asyncHandler(async (req, res) => {
  const partner = await partnerService.setPartnerActive(req.params.id, req.body.isActive);
  success(res, partner, 'Status do sócio atualizado');
});

const updatePermissions = asyncHandler(async (req, res) => {
  const partner = await partnerService.updatePartnerPermissions(req.params.id, req.body);
  success(res, partner, 'Permissões do sócio atualizadas');
});

module.exports = { promote, list, setActive, updatePermissions };
