const { Router } = require('express');
const controller = require('../controllers/order.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize, attachMenu } = require('../middlewares/auth');
const { paymentRateLimiter } = require('../middlewares/rateLimit');
const { createOrderSchema, listOrdersSchema, setManualStartCountSchema } = require('../validators/order.validator');

const router = Router();

router.use(authenticate, attachMenu('pedidos'));

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Criar pedido e gerar pagamento via Mercado Pago (PIX ou cartão de crédito/débito)
 *     description: >
 *       Para produtos ENGAJAMENTO informe targetUsername e/ou targetUrl. Para produtos digitais valida disponibilidade de estoque.
 *       Para paymentMethod=CREDIT_CARD, cardToken/cardPaymentMethodId/installments são obrigatórios — gerados no client via
 *       Card Payment Brick (@mercadopago/sdk-react), nunca envie dados de cartão em texto puro. O Brick aceita tanto crédito
 *       quanto débito; cardPaymentTypeId informa qual foi usado (default credit_card) e define o paymentMethod final gravado
 *       no pedido (CREDIT_CARD ou DEBIT_CARD).
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
 *               paymentMethod: { type: string, enum: [PIX, CREDIT_CARD], default: PIX }
 *               cardToken: { type: string, description: 'Token do cartão gerado pelo Card Payment Brick — obrigatório para CREDIT_CARD' }
 *               cardPaymentMethodId: { type: string, description: 'Bandeira do cartão (ex: master, visa) — obrigatório para CREDIT_CARD' }
 *               cardIssuerId: { type: string }
 *               cardPaymentTypeId: { type: string, enum: [credit_card, debit_card], default: credit_card }
 *               installments: { type: integer, description: 'Obrigatório para CREDIT_CARD' }
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

/**
 * @swagger
 * /orders/admin/{id}/complete:
 *   post:
 *     tags: [Orders]
 *     summary: Marcar pedido como concluído manualmente — ADM/FUNC
 *     description: Para pedidos com pagamento confirmado que a equipe entregou fora do fluxo automático (ex. falha ao criar a ordem na Baratos Sociais). Exige paymentStatus=PAID e orderStatus fora de COMPLETED/CANCELLED.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Pedido atualizado para orderStatus=COMPLETED
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/admin/:id/complete', authorize('ADM', 'FUNC'), controller.completeManually);

/**
 * @swagger
 * /orders/admin/{id}/engagement-status:
 *   get:
 *     tags: [Orders]
 *     summary: Consultar status ao vivo do pedido de engajamento na Baratos Sociais — ADM/FUNC
 *     description: Equivalente a /orders/me/{id}/engagement-status, mas sem restrição de dono do pedido. Atualiza também o payload salvo no chat (ENGAGEMENT_STATUS).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Status atual (charge, start_count, status, remains)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { description: 'Pedido não possui ordem de engajamento associada', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/admin/:id/engagement-status', authorize('ADM', 'FUNC'), controller.adminEngagementStatus);

/**
 * @swagger
 * /orders/admin/{id}/manual-start-count:
 *   put:
 *     tags: [Orders]
 *     summary: Registrar manualmente a contagem inicial de um pedido de engajamento — ADM/FUNC
 *     description: Para pedidos entregues fora do fluxo automático, sem baratosSociaisOrderId (portanto sem start_count vindo da API). Só vale para produtos da categoria ENGAJAMENTO.
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
 *             required: [startCount]
 *             properties:
 *               startCount: { type: integer, minimum: 0, example: 1250 }
 *     responses:
 *       200:
 *         description: Pedido atualizado com manualStartCount preenchido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { description: 'Produto não é de engajamento', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put(
  '/admin/:id/manual-start-count',
  authorize('ADM', 'FUNC'),
  validate(setManualStartCountSchema),
  controller.setManualStartCount
);

module.exports = router;
