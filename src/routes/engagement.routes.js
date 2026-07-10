const { Router } = require('express');
const controller = require('../controllers/engagement.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { setMarginSchema } = require('../validators/engagement.validator');

const router = Router();

router.use(authenticate, authorize('ADM', 'FUNC'));

/**
 * @swagger
 * /engagement/services:
 *   get:
 *     tags: [Engagement]
 *     summary: Listar serviços disponíveis na API Baratos Sociais (cache de 30min) — ADM/FUNC
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema: { type: boolean }
 *         description: 'true para forçar atualização do cache'
 *     responses:
 *       200:
 *         description: Lista de serviços (service, name, category, rate, min, max, refill, cancel)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/services', controller.listServices);

/**
 * @swagger
 * /engagement/balance:
 *   get:
 *     tags: [Engagement]
 *     summary: Consultar saldo da conta Baratos Sociais (ADM only)
 *     responses:
 *       200:
 *         description: '{ balance, currency }'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/balance', authorize('ADM'), controller.balance);

/**
 * @swagger
 * /engagement/products/{productId}/margin:
 *   patch:
 *     tags: [Engagement]
 *     summary: Vincular produto a um serviço da Baratos Sociais e definir margem de lucro (ADM only)
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
 *             required: [baratosSociaisServiceId, profitMarginPercent]
 *             properties:
 *               baratosSociaisServiceId: { type: string, example: "1" }
 *               profitMarginPercent: { type: number, example: 30 }
 *     responses:
 *       200:
 *         description: Produto atualizado com o vínculo e a margem
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { description: 'Produto não é da categoria ENGAJAMENTO', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.patch('/products/:productId/margin', authorize('ADM'), validate(setMarginSchema), controller.setMargin);

/**
 * @swagger
 * /engagement/orders/{orderId}/refill:
 *   post:
 *     tags: [Engagement]
 *     summary: Solicitar reposição (refill) de um pedido de engajamento — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: '{ refill: "1" }'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/orders/:orderId/refill', controller.refill);

/**
 * @swagger
 * /engagement/orders/{orderId}/cancel:
 *   post:
 *     tags: [Engagement]
 *     summary: Cancelar pedido de engajamento na API externa — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resultado do cancelamento; se bem-sucedido o pedido local é marcado como CANCELLED
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/orders/:orderId/cancel', controller.cancel);

module.exports = router;
