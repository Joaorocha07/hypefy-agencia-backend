const { Router } = require('express');
const controller = require('../controllers/stock.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { addStockItemsSchema, listStockItemsSchema } = require('../validators/stock.validator');

const router = Router();

router.use(authenticate, authorize('ADM', 'FUNC'));

/**
 * @swagger
 * /stock/overview:
 *   get:
 *     tags: [Stock]
 *     summary: Visão geral do estoque — disponível/vendido, custo e lucro estimado (ADM only)
 *     responses:
 *       200:
 *         description: Estatísticas agregadas de estoque por produto
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/overview', authorize('ADM'), controller.overview);

/**
 * @swagger
 * /stock/products/{productId}:
 *   post:
 *     tags: [Stock]
 *     summary: Adicionar itens de estoque em lote (credenciais/códigos) — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["email1@netflix.com:senha123", "email2@netflix.com:senha456"]
 *     responses:
 *       201:
 *         description: Itens adicionados; stockQuantity do produto incrementado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   get:
 *     tags: [Stock]
 *     summary: Listar itens de estoque de um produto (sem expor o conteúdo/credenciais) — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isSold
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista paginada de itens de estoque
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/products/:productId', validate(addStockItemsSchema), controller.addItems);
router.get('/products/:productId', validate(listStockItemsSchema), controller.listItems);

module.exports = router;
