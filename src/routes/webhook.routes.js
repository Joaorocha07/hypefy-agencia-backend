const { Router } = require('express');
const controller = require('../controllers/webhook.controller');

const router = Router();

/**
 * @swagger
 * /webhooks/mercado-pago:
 *   post:
 *     tags: [Webhooks]
 *     summary: Notificação de pagamento do Mercado Pago (payment.updated)
 *     description: >
 *       Configurada como notification_url ao criar o pagamento PIX. Valida a assinatura via header x-signature
 *       (HMAC com MP_WEBHOOK_SECRET). Ao confirmar pagamento aprovado, marca o pedido como PAID e dispara a entrega
 *       automática (estoque digital ou pedido na Baratos Sociais). Sempre responde 200 para o Mercado Pago não reenviar.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, example: payment }
 *       - in: query
 *         name: data.id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK (sempre retornado, mesmo em caso de erro de negócio interno)
 */
router.post('/mercado-pago', controller.handleMercadoPago);

module.exports = router;
