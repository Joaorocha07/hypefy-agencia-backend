const { Router } = require('express');
const controller = require('../controllers/chat.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { sendMessageSchema } = require('../validators/chat.validator');

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /chat/{orderId}:
 *   get:
 *     tags: [Chat]
 *     summary: Listar mensagens do chat de um pedido
 *     description: Mensagens com isDelivery=true só aparecem depois que o pagamento do pedido é confirmado (paymentStatus=PAID). Cliente só acessa o próprio pedido; ADM/FUNC acessam qualquer um.
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de mensagens em ordem cronológica
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   post:
 *     tags: [Chat]
 *     summary: Enviar mensagem no chat de um pedido
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, maxLength: 4000 }
 *     responses:
 *       201:
 *         description: Mensagem enviada
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/ChatMessage' } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/:orderId', controller.list);
router.post('/:orderId', validate(sendMessageSchema), controller.send);

module.exports = router;
