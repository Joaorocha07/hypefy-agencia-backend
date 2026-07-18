const { Router } = require('express');
const controller = require('../controllers/order.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { paymentRateLimiter } = require('../middlewares/rateLimit');
const { createOrderSchema, listOrdersSchema } = require('../validators/order.validator');

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Criar pedido e gerar pagamento PIX (Mercado Pago)
 *     description: Para produtos ENGAJAMENTO informe targetUsername e/ou targetUrl. Para produtos digitais valida disponibilidade de estoque.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               quantity: { type: integer, default: 1 }
 *               couponCode: { type: string }
 *               targetUsername: { type: string }
 *               targetUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Pedido criado com QR Code PIX (mercadoPagoQrCode / mercadoPagoQrCodeBase64)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Order' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Estoque insuficiente', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/', paymentRateLimiter, validate(createOrderSchema), controller.create);

/**
 * @swagger
 * /orders/me:
 *   get:
 *     tags: [Orders]
 *     summary: Listar meus pedidos (cliente autenticado)
 *     parameters:
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string, enum: [PENDING, PAID, FAILED, REFUNDED] }
 *       - in: query
 *         name: orderStatus
 *         schema: { type: string, enum: [PENDING, PROCESSING, COMPLETED, CANCELLED] }
 *     responses:
 *       200:
 *         description: Lista paginada dos pedidos do cliente logado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/me', validate(listOrdersSchema), controller.myOrders);

/**
 * @swagger
 * /orders/me/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Detalhe de um pedido do cliente autenticado
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detalhe do pedido (inclui produto)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/me/:id', controller.myOrderDetail);
router.get('/me/:id/engagement-status', controller.myEngagementStatus);

/**
 * @swagger
 * /orders/admin/all:
 *   get:
 *     tags: [Orders]
 *     summary: Listar todos os pedidos — ADM/FUNC
 *     parameters:
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string, enum: [PENDING, PAID, FAILED, REFUNDED] }
 *       - in: query
 *         name: orderStatus
 *         schema: { type: string, enum: [PENDING, PROCESSING, COMPLETED, CANCELLED] }
 *     responses:
 *       200:
 *         description: Lista paginada de todos os pedidos (inclui dados do cliente)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/admin/all', authorize('ADM', 'FUNC'), validate(listOrdersSchema), controller.listAdmin);

/**
 * @swagger
 * /orders/admin/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Detalhe de qualquer pedido — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detalhe completo do pedido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/admin/:id', authorize('ADM', 'FUNC'), controller.getAdmin);

module.exports = router;
