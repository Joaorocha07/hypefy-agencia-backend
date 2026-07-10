const { Router } = require('express');
const controller = require('../controllers/product.controller');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { authenticate, authorize } = require('../middlewares/auth');
const {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  setActiveSchema,
} = require('../validators/product.validator');

const router = Router();

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products - Público]
 *     summary: Listar catálogo público de produtos (ativos)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: platformId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de produtos ativos (sem campos financeiros)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/', validate(listProductsSchema), controller.listPublic);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products - Público]
 *     summary: Detalhe de um produto ativo
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Produto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Product' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', controller.getOne);

/**
 * @swagger
 * /products/admin/all:
 *   get:
 *     tags: [Products - Admin]
 *     summary: Listar todos os produtos (inclui inativos) — ADM/FUNC
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: platformId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista paginada (FUNC não recebe costPrice/profitMarginPercent)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  '/admin/all',
  authenticate,
  authorize('ADM', 'FUNC'),
  validate(listProductsSchema),
  controller.listAdmin
);

/**
 * @swagger
 * /products/admin/{id}:
 *   get:
 *     tags: [Products - Admin]
 *     summary: Detalhe de um produto (inclui inativos) — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Produto encontrado (FUNC não recebe costPrice/profitMarginPercent)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Product' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/admin/:id', authenticate, authorize('ADM', 'FUNC'), controller.getAdminOne);

/**
 * @swagger
 * /products/admin:
 *   post:
 *     tags: [Products - Admin]
 *     summary: Criar produto (ADM/FUNC — FUNC não pode definir price/costPrice/profitMarginPercent)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, price, categoryId, platformId]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               costPrice: { type: number, description: 'Somente ADM' }
 *               stockQuantity: { type: integer }
 *               categoryId: { type: string, format: uuid }
 *               platformId: { type: string, format: uuid }
 *               baratosSociaisServiceId: { type: string }
 *               profitMarginPercent: { type: number, description: 'Somente ADM' }
 *               image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Produto criado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Product' } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/admin',
  authenticate,
  authorize('ADM', 'FUNC'),
  upload.single('image'),
  validate(createProductSchema),
  controller.create
);

/**
 * @swagger
 * /products/admin/{id}:
 *   put:
 *     tags: [Products - Admin]
 *     summary: Editar produto (ADM/FUNC — FUNC não pode alterar price/costPrice/profitMarginPercent)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               costPrice: { type: number }
 *               stockQuantity: { type: integer }
 *               categoryId: { type: string, format: uuid }
 *               platformId: { type: string, format: uuid }
 *               profitMarginPercent: { type: number }
 *               isActive: { type: boolean }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Produto atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put(
  '/admin/:id',
  authenticate,
  authorize('ADM', 'FUNC'),
  upload.single('image'),
  validate(updateProductSchema),
  controller.update
);

/**
 * @swagger
 * /products/admin/{id}/active:
 *   patch:
 *     tags: [Products - Admin]
 *     summary: Ativar/inativar produto (ADM/FUNC)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  '/admin/:id/active',
  authenticate,
  authorize('ADM', 'FUNC'),
  validate(setActiveSchema),
  controller.setActive
);

/**
 * @swagger
 * /products/admin/{id}:
 *   delete:
 *     tags: [Products - Admin]
 *     summary: Excluir produto — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Produto excluído
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Produto possui estoque ou pedidos vinculados; inative-o em vez de excluir' }
 */
router.delete('/admin/:id', authenticate, authorize('ADM', 'FUNC'), controller.remove);

module.exports = router;
