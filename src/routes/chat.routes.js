const { Router } = require('express');
const controller = require('../controllers/chat.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { sendMessageSchema } = require('../validators/chat.validator');

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /chat/unread-count:
 *   get:
 *     tags: [Chat]
 *     summary: Total de mensagens não lidas do cliente autenticado
 *     description: Soma, em todos os pedidos do usuário, as mensagens (vendedor/sistema) criadas após o último acesso do cliente ao chat de cada pedido (`customerLastReadAt`). Abrir o chat de um pedido (GET /chat/{orderId}) ou marcar como lido (POST /chat/{orderId}/read ou /chat/read-all) zera essas mensagens.
 *     responses:
 *       200:
 *         description: Contagem de mensagens não lidas
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { type: object, properties: { count: { type: integer } } } }
 */
router.get('/unread-count', controller.unreadCount);

/**
 * @swagger
 * /chat/notifications:
 *   get:
 *     tags: [Chat]
 *     summary: Notificações do cliente autenticado (lidas e não lidas)
 *     description: Um item por pedido com atividade de vendedor/sistema no chat — a mensagem mais recente de cada pedido, lida ou não. Ordenado da mais recente para a mais antiga, limitado a 20 itens. Usado para popular o dropdown de notificações do header (a contagem do sino vem de /chat/unread-count).
 *     responses:
 *       200:
 *         description: Notificações
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
 *                           productTitle: { type: string }
 *                           type: { type: string, enum: [delivery, payment_confirmed, system, chat_message] }
 *                           message: { type: string }
 *                           isUnread: { type: boolean }
 *                           unreadCount: { type: integer }
 *                           createdAt: { type: string, format: date-time }
 */
router.get('/notifications', controller.notifications);

/**
 * @swagger
 * /chat/read-all:
 *   post:
 *     tags: [Chat]
 *     summary: Marca o chat de todos os pedidos do cliente como lido
 *     responses:
 *       200:
 *         description: Todas as notificações marcadas como lidas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/read-all', controller.markAllRead);

/**
 * @swagger
 * /chat/admin/notifications:
 *   get:
 *     tags: [Chat]
 *     summary: Notificações de chat para a equipe (ADM/FUNC) — todas as mensagens de clientes
 *     description: Global, não filtrado por pedidos "do" funcionário (staff acessa qualquer pedido). Um item por pedido com mensagens do cliente, lidas ou não, comparadas ao `staffLastReadAt` do pedido (compartilhado entre toda a equipe — quem abrir o chat marca como lido para todos). Ordenado da mais recente para a mais antiga, limitado a 20 itens.
 *     responses:
 *       200:
 *         description: Notificações
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
 *                           productTitle: { type: string }
 *                           customerName: { type: string }
 *                           message: { type: string }
 *                           isUnread: { type: boolean }
 *                           unreadCount: { type: integer }
 *                           createdAt: { type: string, format: date-time }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/admin/notifications', authorize('ADM', 'FUNC', 'SOCIO'), controller.staffNotifications);

/**
 * @swagger
 * /chat/admin/unread-count:
 *   get:
 *     tags: [Chat]
 *     summary: Total de mensagens de clientes não lidas pela equipe
 *     responses:
 *       200:
 *         description: Contagem de mensagens não lidas
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { type: object, properties: { count: { type: integer } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/admin/unread-count', authorize('ADM', 'FUNC', 'SOCIO'), controller.staffUnreadCount);

/**
 * @swagger
 * /chat/admin/read-all:
 *   post:
 *     tags: [Chat]
 *     summary: Marca o chat de todos os pedidos como lido pela equipe
 *     responses:
 *       200:
 *         description: Todas as notificações marcadas como lidas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post('/admin/read-all', authorize('ADM', 'FUNC', 'SOCIO'), controller.staffMarkAllRead);

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

/**
 * @swagger
 * /chat/{orderId}/read:
 *   post:
 *     tags: [Chat]
 *     summary: Marca o chat de um pedido específico como lido
 *     description: Cliente marca customerLastReadAt; ADM/FUNC marca staffLastReadAt (compartilhado com toda a equipe).
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Marcado como lido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/:orderId/read', controller.markRead);

module.exports = router;
