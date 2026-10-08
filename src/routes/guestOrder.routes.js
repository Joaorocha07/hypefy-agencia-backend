const { Router } = require('express');
const controller = require('../controllers/guestOrder.controller');
const validate = require('../middlewares/validate');
const { paymentRateLimiter } = require('../middlewares/rateLimit');
const { createGuestOrderSchema, guestOrderStatusSchema } = require('../validators/guestOrder.validator');

// Rotas públicas (sem authenticate) — checkout sem login, só para os produtos
// de GUEST_CHECKOUT_PRODUCT_IDS (ver guestOrder.service.js).
const router = Router();

/**
 * @swagger
 * /guest-orders:
 *   post:
 *     tags: [Orders]
 *     summary: Criar pedido sem login (email + CPF), PIX ou cartão — só produtos de GUEST_CHECKOUT_PRODUCT_IDS
 *     description: >
 *       Reaproveita a conta se o email já existir (sem alterar seus dados) ou cria uma conta sem senha.
 *       Todos os produtos saem num único pagamento (CartOrder). Cartão costuma voltar PAID/FAILED na hora. Retorna o QR Code e um token para consultar
 *       o status em GET /guest-orders/{id}/status (id = CartOrder).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productIds, email, cpf]
 *             properties:
 *               productIds: { type: array, items: { type: string, format: uuid } }
 *               email: { type: string, format: email }
 *               cpf: { type: string }
 *               deviceId: { type: string }
 *               paymentMethod: { type: string, enum: [PIX, CREDIT_CARD], default: PIX }
 *               cardToken: { type: string, description: 'Token do Card Payment Brick — obrigatório para CREDIT_CARD' }
 *               cardPaymentMethodId: { type: string }
 *               cardIssuerId: { type: string }
 *               cardPaymentTypeId: { type: string, enum: [credit_card, debit_card], default: credit_card }
 *               installments: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       201: { description: 'Pedido criado ({ order, token })' }
 *       403: { description: 'Produto não liberado para compra sem login' }
 *       409: { description: 'Estoque insuficiente' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/', paymentRateLimiter, validate(createGuestOrderSchema), controller.create);

/**
 * @swagger
 * /guest-orders/{id}/status:
 *   get:
 *     tags: [Orders]
 *     summary: Status de pagamento de um pedido sem login
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ id, paymentStatus }' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/status', validate(guestOrderStatusSchema), controller.status);

module.exports = router;
