const { Router } = require('express');
const controller = require('../controllers/stock.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const {
  addStockItemsSchema,
  listStockItemsSchema,
  updateStockItemSchema,
  updateScreenPinSchema,
  notifyAccessUpdateSchema,
  addManualStockSchema,
  setManualCostSchema,
} = require('../validators/stock.validator');

const router = Router();

router.use(authenticate, authorize('ADM', 'FUNC'));

/**
 * @swagger
 * /stock/overview:
 *   get:
 *     tags: [Stock]
 *     summary: Visão geral do estoque — disponível/vendido, custo e lucro estimado (ADM only)
 *     responses:
 *       200:
 *         description: Estatísticas agregadas de estoque por produto
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/overview', authorize('ADM'), controller.overview);

/**
 * @swagger
 * /stock/products/{productId}:
 *   post:
 *     tags: [Stock]
 *     summary: Adicionar itens de estoque em lote (credenciais/códigos) — ADM/FUNC
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
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 description: 'Cada item pode ser uma string simples (content) ou um objeto { content, quantidade } — quantidade é o número de vagas/telas que a conta suporta (padrão 1).'
 *                 items:
 *                   oneOf:
 *                     - type: string
 *                     - type: object
 *                       required: [content]
 *                       properties:
 *                         content: { type: string }
 *                         quantidade: { type: integer, default: 1 }
 *                 example: [{ "content": "Email: email1@netflix.com\nSenha: senha123", "quantidade": 4 }]
 *     responses:
 *       201:
 *         description: Itens adicionados; stockQuantity do produto incrementado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   get:
 *     tags: [Stock]
 *     summary: Listar itens de estoque de um produto, um por vaga (sem expor o conteúdo/credenciais) — ADM/FUNC
 *     description: 'Raw, uma linha por StockItem/vaga — usado por telas que precisam do evento individual (ex: histórico de movimentação). Para a visão "uma linha por conta compartilhada", ver GET /stock/products/{productId}/accounts.'
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isSold
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista paginada de itens de estoque
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/products/:productId', validate(addStockItemsSchema), controller.addItems);
router.get('/products/:productId', validate(listStockItemsSchema), controller.listItems);

/**
 * @swagger
 * /stock/products/{productId}/manual:
 *   post:
 *     tags: [Stock]
 *     summary: Adicionar vagas de entrega manual (sem credenciais) — ADM/FUNC
 *     description: >
 *       Cria `quantity` StockItem sem conteúdo (content vazio, isManual=true) — contam para
 *       o estoque disponível do produto, mas quando vendidas não entregam credenciais
 *       automaticamente: o pedido vai para orderStatus=PROCESSING e o cliente recebe uma
 *       mensagem automática no chat com um link de WhatsApp (SUPPORT_WHATSAPP_NUMBER) para
 *       agilizar caso o chat demore.
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
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 1, example: 5 }
 *     responses:
 *       201:
 *         description: Vagas adicionadas; stockQuantity do produto incrementado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/products/:productId/manual', validate(addManualStockSchema), controller.addManualItems);

/**
 * @swagger
 * /stock/products/{productId}/manual-cost:
 *   patch:
 *     tags: [Stock]
 *     summary: Definir/editar o custo dos pedidos de entrega manual deste produto (ADM only)
 *     description: Usado no lugar do custo de estoque normal quando o pedido é atendido por uma vaga manual — editável a qualquer momento, já que o custo real da entrega manual pode variar.
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
 *             required: [manualCostPrice]
 *             properties:
 *               manualCostPrice: { type: number, nullable: true, example: 12.5 }
 *     responses:
 *       200:
 *         description: Produto atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  '/products/:productId/manual-cost',
  authorize('ADM'),
  validate(setManualCostSchema),
  controller.setManualCost
);

/**
 * @swagger
 * /stock/products/{productId}/accounts:
 *   get:
 *     tags: [Stock]
 *     summary: Listar contas de estoque de um produto, agrupadas por credencial — ADM/FUNC
 *     description: >
 *       Uma conta compartilhada vira vários StockItem (um por vaga vendida) com o mesmo `content`.
 *       Agrupa por `content` e retorna uma linha por conta (com `available`/`sold` somando as vagas
 *       daquele grupo), em vez de uma linha idêntica por vaga. `id` é uma vaga representante do grupo
 *       (uma disponível, se houver) — usado como âncora para `PUT /stock/items/{itemId}`.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isSold
 *         description: 'true = só contas com ao menos uma vaga vendida; false = só contas com ao menos uma vaga disponível'
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista paginada de contas (agrupadas)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/products/:productId/accounts', validate(listStockItemsSchema), controller.listAccounts);

/**
 * @swagger
 * /stock/products/{productId}/notify-access-update:
 *   post:
 *     tags: [Stock]
 *     summary: 'Envia um acesso atualizado (ex: senha trocada de conta compartilhada) para os clientes ainda dentro do prazo do produto — ADM/FUNC'
 *     description: >
 *       Considera pedidos pagos deste produto criados nos últimos `accessDurationDays` dias
 *       (todos os pedidos pagos, se o produto não tiver prazo definido). Para cada um, posta uma
 *       mensagem de entrega (`isDelivery=true`) no chat com o novo conteúdo e atualiza
 *       `Order.deliveredContent`.
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
 *             required: [content]
 *             properties:
 *               content: { type: string, description: 'Novo texto de acesso (email/senha/link)' }
 *               orderIds: { type: array, items: { type: string, format: uuid }, description: 'Opcional — restringe o envio a um subconjunto dos pedidos elegíveis (ex: seleção manual na tela). Se omitido, envia para todos os elegíveis.' }
 *     responses:
 *       200:
 *         description: Quantidade de clientes notificados
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { type: object, properties: { notifiedCount: { type: integer } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post(
  '/products/:productId/notify-access-update',
  validate(notifyAccessUpdateSchema),
  controller.notifyAccessUpdate
);

/**
 * @swagger
 * /stock/products/{productId}/access-log:
 *   get:
 *     tags: [Stock]
 *     summary: Últimos envios de atualização de acesso deste produto — ADM/FUNC
 *     description: Status é sempre "Enviado" — as mensagens são gravadas de forma síncrona no chat interno, não há um canal externo (email/WhatsApp) cuja entrega possa falhar.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Últimos 10 envios
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           recipientCount: { type: integer }
 *                           sentByName: { type: string }
 *                           createdAt: { type: string, format: date-time }
 *                           status: { type: string, enum: [Enviado] }
 */
router.get('/products/:productId/access-log', controller.accessLog);

/**
 * @swagger
 * /stock/products/{productId}/notify-preview:
 *   get:
 *     tags: [Stock]
 *     summary: Lista quem receberia um acesso atualizado agora, sem enviar nada — ADM/FUNC
 *     description: Mesmo critério de elegibilidade do POST notify-access-update (pedidos pagos dentro de accessDurationDays), usado para mostrar ao operador quem vai ser notificado antes de confirmar o envio.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Clientes elegíveis
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           orderId: { type: string, format: uuid }
 *                           customerName: { type: string }
 *                           customerEmail: { type: string }
 *                           customerPhone: { type: string, nullable: true }
 *                           orderCreatedAt: { type: string, format: date-time }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/products/:productId/notify-preview', controller.previewNotifyRecipients);

/**
 * @swagger
 * /stock/items/{itemId}:
 *   put:
 *     tags: [Stock]
 *     summary: Editar as credenciais de uma conta compartilhada — ADM/FUNC
 *     description: '`itemId` é uma vaga qualquer daquela conta (ver GET /stock/products/{productId}). Atualiza TODOS os StockItem (vendidos e disponíveis) que atualmente têm o mesmo content, já que representam a mesma conta. Se quantidade for maior que o total de vagas hoje (vendidas + disponíveis), a diferença é criada como novas vagas disponíveis — assim dá para repor uma conta esgotada sem recadastrar as credenciais.'
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *               quantidade: { type: integer, description: 'Total de vagas/telas que essa conta deve ter — opcional, mantém o valor atual se omitido. Se maior que o total de vagas existentes, as vagas que faltam são criadas como disponíveis.' }
 *     responses:
 *       200:
 *         description: Quantidade de vagas atualizadas, quantas foram criadas e o novo conteúdo
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties: { updatedCount: { type: integer }, addedCount: { type: integer }, content: { type: string }, quantidade: { type: integer } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/items/:itemId', validate(updateStockItemSchema), controller.updateItem);
router.patch('/items/:itemId/pin', validate(updateScreenPinSchema), controller.updatePin);

/**
 * @swagger
 * /stock/items/{itemId}/customers:
 *   get:
 *     tags: [Stock]
 *     summary: Clientes que compraram uma vaga desta conta compartilhada — ADM/FUNC
 *     description: '`itemId` é uma vaga qualquer daquela conta. Retorna um item por vaga vendida com o mesmo content, com dados do pedido e do cliente (nome, email, telefone, avatar) para contato direto.'
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Clientes com vaga vendida nesta conta
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           stockItemId: { type: string, format: uuid }
 *                           orderId: { type: string, format: uuid }
 *                           paymentStatus: { type: string }
 *                           orderStatus: { type: string }
 *                           orderCreatedAt: { type: string, format: date-time }
 *                           customerId: { type: string, format: uuid }
 *                           customerName: { type: string }
 *                           customerEmail: { type: string }
 *                           customerPhone: { type: string, nullable: true }
 *                           customerAvatarUrl: { type: string, nullable: true }
 *                           lastAccessUpdateAt: { type: string, format: date-time, nullable: true }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/items/:itemId/customers', controller.getCustomers);

module.exports = router;
