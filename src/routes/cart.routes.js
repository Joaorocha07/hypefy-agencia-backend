const { Router } = require('express');
const controller = require('../controllers/cart.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { paymentRateLimiter } = require('../middlewares/rateLimit');
const { cartQuoteSchema, checkoutCartSchema } = require('../validators/cart.validator');

const router = Router();

/**
 * @swagger
 * /cart/quote:
 *   post:
 *     tags: [Cart]
 *     summary: Calcular subtotal/desconto/total do carrinho (sem criar nada)
 *     description: >
 *       Só produtos fora da categoria ENGAJAMENTO. Acima de R$100 de subtotal aplica 10% de desconto
 *       automático; se houver couponCode, só vale o maior desconto entre o cupom e os 10% automáticos.
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
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: integer, default: 1 }
 *               couponCode: { type: string }
 *     responses:
 *       200:
 *         description: subtotal, discountAmount, totalPrice, discountSource (CART_THRESHOLD | COUPON | null), nextDiscountAt (quanto falta pro desconto automático)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { description: 'Produto não encontrado', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: 'Estoque insuficiente', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/quote', validate(cartQuoteSchema), controller.quote);

/**
 * @swagger
 * /cart/checkout:
 *   post:
 *     tags: [Cart]
 *     summary: Finalizar carrinho e gerar 1 pagamento combinado (PIX ou cartão de crédito/débito)
 *     description: >
 *       Cada produto vira um pedido normal (aparece em "Meus pedidos" como sempre), mas todos
 *       compartilham um único pagamento. Para paymentMethod=CREDIT_CARD, cardToken/cardPaymentMethodId/
 *       installments são obrigatórios (gerados no client via Card Payment Brick).
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
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: integer, default: 1 }
 *               couponCode: { type: string }
 *               paymentMethod: { type: string, enum: [PIX, CREDIT_CARD], default: PIX }
 *               cardToken: { type: string }
 *               cardPaymentMethodId: { type: string }
 *               cardIssuerId: { type: string }
 *               cardPaymentTypeId: { type: string, enum: [credit_card, debit_card], default: credit_card }
 *               installments: { type: integer }
 *     responses:
 *       201:
 *         description: CartOrder criado com QR Code PIX (mercadoPagoQrCode/mercadoPagoQrCodeBase64) e a lista de pedidos (orders) gerados
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Estoque insuficiente', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/checkout', authenticate, paymentRateLimiter, validate(checkoutCartSchema), controller.checkout);

/**
 * @swagger
 * /cart/{id}:
 *   get:
 *     tags: [Cart]
 *     summary: Detalhe de um carrinho finalizado (cliente dono)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: CartOrder com os pedidos (orders) incluídos — usado para acompanhar/pollar o pagamento
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', authenticate, controller.getOne);

module.exports = router;
