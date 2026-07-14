const { Router } = require('express');
const controller = require('../controllers/webhook.controller');

const router = Router();

/**
 * @swagger
 * /webhooks/mercado-pago:
 *   post:
 *     tags: [Webhooks]
 *     summary: Notificação de order do Mercado Pago (Orders API - order.action_required / order.processed / etc.)
 *     description: >
 *       Configurada como config.online.callback_url ao criar a Order PIX. Valida a assinatura via header x-signature
 *       (HMAC com MP_WEBHOOK_SECRET). data.id é o ID da Order (não de um Payment); ao confirmar status "processed",
 *       marca o pedido como PAID e dispara a entrega automática (estoque digital ou pedido na Baratos Sociais).
 *       Sempre responde 200 para o Mercado Pago não reenviar.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, example: order }
 *       - in: query
 *         name: data.id
 *         schema: { type: string, example: ORD01JQ4S4KY8HWQ6NA5PXB65B3D3 }
 *     responses:
 *       200:
 *         description: OK (sempre retornado, mesmo em caso de erro de negócio interno)
 */
router.post('/mercado-pago', controller.handleMercadoPago);

module.exports = router;
