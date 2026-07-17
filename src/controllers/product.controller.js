const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const productService = require('../services/product.service');

const listPublic = asyncHandler(async (req, res) => {
  const result = await productService.listPublicProducts(req.query);
  success(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const product = await productService.getPublicProductById(req.params.id);
  success(res, product);
});

const quote = asyncHandler(async (req, res) => {
  const result = await productService.getPublicQuote(req.params.id, req.query.quantity);
  success(res, result);
});

const listAdmin = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query, req.user.role);
  success(res, result);
});

const getAdminOne = asyncHandler(async (req, res) => {
  const product = await productService.getProductByIdForRole(req.params.id, req.user.role);
  success(res, product);
});

const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.user.role, req.body, req.file);
  success(res, product, 'Produto criado com sucesso', 201);
});

const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.user.role, req.params.id, req.body, req.file);
  success(res, product, 'Produto atualizado com sucesso');
});

const setActive = asyncHandler(async (req, res) => {
  const product = await productService.setActive(req.params.id, req.body.isActive);
  success(res, product, 'Status do produto atualizado');
});

const setFeatured = asyncHandler(async (req, res) => {
  const product = await productService.setFeatured(req.params.id, req.body.isFeatured);
  success(res, product, product.isFeatured ? 'Produto marcado como destaque' : 'Produto removido dos destaques');
});

const remove = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  success(res, null, 'Produto excluído com sucesso');
});

module.exports = { listPublic, getOne, quote, listAdmin, getAdminOne, create, update, setActive, setFeatured, remove };
