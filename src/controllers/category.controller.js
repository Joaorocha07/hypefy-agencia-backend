const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const categoryService = require('../services/category.service');

const list = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories();
  success(res, categories);
});

const create = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  success(res, category, 'Categoria criada com sucesso', 201);
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  success(res, category, 'Categoria atualizada com sucesso');
});

const remove = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  success(res, null, 'Categoria removida com sucesso');
});

module.exports = { list, create, update, remove };
