const { Router } = require('express');
const controller = require('../controllers/customer.controller');
const validate = require('../middlewares/validate');
const { listCustomersSchema } = require('../validators/customer.validator');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router();

router.use(authenticate, authorize('ADM', 'FUNC'));

/**
 * @swagger
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: Listar clientes cadastrados (role USER) — ADM/FUNC
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Busca por nome ou email
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista paginada de clientes com contagem de pedidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/', validate(listCustomersSchema), controller.list);

/**
 * @swagger
 * /customers/{id}/orders:
 *   get:
 *     tags: [Customers]
 *     summary: Histórico de pedidos de um cliente — ADM/FUNC
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados do cliente + lista de pedidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/orders', controller.getOrders);

/**
 * @swagger
 * /customers/{id}/promote:
 *   patch:
 *     tags: [Customers]
 *     summary: Promove um cliente (role USER) a funcionário (role FUNC) — ADM only
 *     description: Reaproveita a conta existente do cliente (login, senha, histórico de pedidos) — só o role muda, não é criado um novo usuário.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Cliente promovido, agora com role FUNC
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Usuário já não é mais um cliente comum', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.patch('/:id/promote', authorize('ADM'), controller.promote);

module.exports = router;
