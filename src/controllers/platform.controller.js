const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const platformService = require('../services/platform.service');

const list = asyncHandler(async (req, res) => {
  const platforms = await platformService.listPlatforms();
  success(res, platforms);
});

const create = asyncHandler(async (req, res) => {
  const platform = await platformService.createPlatform(req.body, req.file);
  success(res, platform, 'Plataforma criada com sucesso', 201);
});

const update = asyncHandler(async (req, res) => {
  const platform = await platformService.updatePlatform(req.params.id, req.body, req.file);
  success(res, platform, 'Plataforma atualizada com sucesso');
});

const remove = asyncHandler(async (req, res) => {
  await platformService.deletePlatform(req.params.id);
  success(res, null, 'Plataforma removida com sucesso');
});

module.exports = { list, create, update, remove };
