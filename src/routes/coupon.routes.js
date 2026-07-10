const { Router } = require('express');
const controller = require('../controllers/coupon.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { createCouponSchema, updateCouponSchema } = require('../validators/coupon.validator');

const router = Router();

// Cupons são exclusivos do ADM (FUNC não pode criar/editar/gerenciar)
router.use(authenticate, authorize('ADM'));

/**
 * @swagger
 * /coupons:
 *   post:
 *     tags: [Coupons]
 *     summary: Criar cupom promocional (ADM only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discountValue]
 *             properties:
 *               code: { type: string, example: PROMO10 }
 *               discountType: { type: string, enum: [PERCENTAGE, FIXED], default: PERCENTAGE }
 *               discountValue: { type: number }
 *               maxUses: { type: integer }
 *               validFrom: { type: string, format: date-time }
 *               validUntil: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Cupom criado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Coupon' } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { description: 'Código já existe', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *   get:
 *     tags: [Coupons]
 *     summary: Listar cupons (ADM only)
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Lista de cupons ativos e/ou expirados
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/', validate(createCouponSchema), controller.create);
router.get('/', controller.list);

/**
 * @swagger
 * /coupons/{id}:
 *   put:
 *     tags: [Coupons]
 *     summary: Atualizar cupom (ADM only)
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
 *               discountType: { type: string, enum: [PERCENTAGE, FIXED] }
 *               discountValue: { type: number }
 *               maxUses: { type: integer }
 *               validFrom: { type: string, format: date-time }
 *               validUntil: { type: string, format: date-time }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Cupom atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id', validate(updateCouponSchema), controller.update);

/**
 * @swagger
 * /coupons/{id}/deactivate:
 *   patch:
 *     tags: [Coupons]
 *     summary: Desativar cupom (ADM only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Cupom desativado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/deactivate', controller.deactivate);

module.exports = router;
