const { Router } = require('express');
const controller = require('../controllers/manualPixPayment.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize, attachMenu } = require('../middlewares/auth');
const {
  createManualPixPaymentSchema,
  updateManualPixPaymentSchema,
  listManualPixPaymentsSchema,
} = require('../validators/manualPixPayment.validator');

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /manual-pix-payments:
 *   get:
 *     tags: [ManualPixPayments]
 *     summary: Listar pagamentos PIX registrados manualmente (fora do site) — ADM/FUNC/SOCIO com menu "pedidosManuais"
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada dos pagamentos, com totalAmount somado do período filtrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [ManualPixPayments]
 *     summary: Registrar pagamento PIX recebido fora do site — ADM/FUNC/SOCIO com menu "pedidosManuais"
 *     description: >
 *       Para clientes que pagaram diretamente à equipe (WhatsApp, presencial etc.), sem passar pelo checkout.
 *       Cria também uma Transaction (SALE), então o valor entra automaticamente na receita/lucro líquido do
 *       Dashboard e no cálculo de repasse de sócio.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerName, customerPhone, amount]
 *             properties:
 *               customerName: { type: string, example: 'Maria Souza' }
 *               customerPhone: { type: string, example: '(11) 91234-5678' }
 *               amount: { type: number, example: 39.9 }
 *               productId: { type: string, format: uuid, description: 'Produto vendido, opcional' }
 *               note: { type: string, description: 'Observação livre, opcional' }
 *     responses:
 *       201:
 *         description: Pagamento registrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { description: 'Produto não encontrado', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/', attachMenu('pedidosManuais'), authorize('ADM', 'FUNC'), validate(listManualPixPaymentsSchema), controller.list);
router.post('/', attachMenu('pedidosManuais'), authorize('ADM', 'FUNC'), validate(createManualPixPaymentSchema), controller.create);

/**
 * @swagger
 * /manual-pix-payments/{id}:
 *   put:
 *     tags: [ManualPixPayments]
 *     summary: Editar pagamento PIX registrado manualmente — ADM only
 *     description: Exclusivo do ADM master — não é delegável a SOCIO mesmo com o menu "pedidosManuais" liberado.
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
 *               customerName: { type: string }
 *               customerPhone: { type: string }
 *               amount: { type: number }
 *               productId: { type: string, format: uuid, nullable: true }
 *               note: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Pagamento atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [ManualPixPayments]
 *     summary: Excluir pagamento PIX registrado manualmente — ADM only
 *     description: Remove também a Transaction (SALE) associada — o valor deixa de contar na receita/lucro líquido.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Pagamento removido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id', authorize('ADM'), validate(updateManualPixPaymentSchema), controller.update);
router.delete('/:id', authorize('ADM'), controller.remove);

module.exports = router;
