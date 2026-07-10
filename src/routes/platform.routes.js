const { Router } = require('express');
const controller = require('../controllers/platform.controller');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { authenticate, authorize } = require('../middlewares/auth');
const { createPlatformSchema, updatePlatformSchema } = require('../validators/platform.validator');

const router = Router();

/**
 * @swagger
 * /platforms:
 *   get:
 *     tags: [Platforms]
 *     summary: Listar plataformas de produtos
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de plataformas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *   post:
 *     tags: [Platforms]
 *     summary: Criar plataforma — ADM/FUNC
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               color: { type: string, description: 'Hex #RRGGBB' }
 *               logo: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Plataforma criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       409: { description: 'Nome já cadastrado' }
 */
router.get('/', controller.list);
router.post(
  '/',
  authenticate,
  authorize('ADM', 'FUNC'),
  upload.single('logo'),
  validate(createPlatformSchema),
  controller.create
);

/**
 * @swagger
 * /platforms/{id}:
 *   put:
 *     tags: [Platforms]
 *     summary: Editar plataforma — ADM/FUNC
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               color: { type: string, description: 'Hex #RRGGBB' }
 *               logo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Plataforma atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Platforms]
 *     summary: Excluir plataforma — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Plataforma removida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Existem produtos vinculados a esta plataforma' }
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADM', 'FUNC'),
  upload.single('logo'),
  validate(updatePlatformSchema),
  controller.update
);
router.delete('/:id', authenticate, authorize('ADM', 'FUNC'), controller.remove);

module.exports = router;
