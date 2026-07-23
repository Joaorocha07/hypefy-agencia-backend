const { Router } = require('express');
const controller = require('../controllers/category.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { createCategorySchema, updateCategorySchema, reorderCategoriesSchema } = require('../validators/category.validator');

const router = Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: Listar categorias de produtos
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de categorias
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *   post:
 *     tags: [Categories]
 *     summary: Criar categoria — ADM/FUNC
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Categoria criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       409: { description: 'Nome já cadastrado' }
 */
router.get('/', controller.list);
router.post('/', authenticate, authorize('ADM', 'FUNC'), validate(createCategorySchema), controller.create);

/**
 * @swagger
 * /categories/reorder:
 *   patch:
 *     tags: [Categories]
 *     summary: Reordenar seções de categoria na loja — ADM/FUNC
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
 *                 items:
 *                   type: object
 *                   required: [id, order]
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     order: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Lista de categorias na nova ordem
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.patch('/reorder', authenticate, authorize('ADM', 'FUNC'), validate(reorderCategoriesSchema), controller.reorder);

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     tags: [Categories]
 *     summary: Editar categoria — ADM/FUNC
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Categoria atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Categories]
 *     summary: Excluir categoria — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Categoria removida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Existem produtos vinculados a esta categoria' }
 */
router.put('/:id', authenticate, authorize('ADM', 'FUNC'), validate(updateCategorySchema), controller.update);
router.delete('/:id', authenticate, authorize('ADM', 'FUNC'), controller.remove);

module.exports = router;
