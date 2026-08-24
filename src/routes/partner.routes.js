const { Router } = require('express');
const controller = require('../controllers/partner.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { promotePartnerSchema, setActiveSchema, updatePermissionsSchema } = require('../validators/partner.validator');

const router = Router();

// Gestão de sócios (role SOCIO) é exclusiva do ADM — inclusive definir quais
// menus, a % de repasse e a partir de que data cada sócio enxerga valores financeiros.
router.use(authenticate, authorize('ADM'));

/**
 * @swagger
 * /partners/promote:
 *   post:
 *     tags: [Partners]
 *     summary: Promove um cliente (role USER) a sócio (role SOCIO) — ADM only
 *     description: Reaproveita a conta existente do cliente (login, senha, histórico de pedidos) — busque o cliente em /customers e informe o id aqui.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId]
 *             properties:
 *               customerId: { type: string, format: uuid }
 *               allowedMenus:
 *                 type: array
 *                 items: { type: string }
 *                 example: [dashboard, pedidos]
 *               financialVisibleFrom: { type: string, format: date-time, nullable: true }
 *               profitSharePercent: { type: number, minimum: 0, maximum: 100, example: 20 }
 *     responses:
 *       201:
 *         description: Sócio criado a partir do cliente
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Usuário já não é mais um cliente comum', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/promote', validate(promotePartnerSchema), controller.promote);

/**
 * @swagger
 * /partners:
 *   get:
 *     tags: [Partners]
 *     summary: Listar sócios — ADM only
 *     description: Cada item inclui netProfitSincePayout e payoutAmount (lucro líquido e valor de repasse desde financialVisibleFrom).
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Lista de sócios
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/', controller.list);

/**
 * @swagger
 * /partners/{id}/active:
 *   patch:
 *     tags: [Partners]
 *     summary: Ativar/inativar sócio — ADM only
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
router.patch('/:id/active', validate(setActiveSchema), controller.setActive);

/**
 * @swagger
 * /partners/{id}/permissions:
 *   patch:
 *     tags: [Partners]
 *     summary: Definir menus, % de repasse e data de corte financeira do sócio — ADM only
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
 *             properties:
 *               allowedMenus:
 *                 type: array
 *                 items: { type: string }
 *               financialVisibleFrom: { type: string, format: date-time, nullable: true }
 *               profitSharePercent: { type: number, minimum: 0, maximum: 100 }
 *     responses:
 *       200:
 *         description: Permissões atualizadas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch('/:id/permissions', validate(updatePermissionsSchema), controller.updatePermissions);

module.exports = router;
