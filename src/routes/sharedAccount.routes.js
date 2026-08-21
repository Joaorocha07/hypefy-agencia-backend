const { Router } = require('express');
const controller = require('../controllers/sharedAccount.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { createSharedAccountSchema, updateSharedAccountSchema } = require('../validators/sharedAccount.validator');

const router = Router();

router.use(authenticate, authorize('ADM'));

/**
 * @swagger
 * /shared-accounts:
 *   get:
 *     tags: [Shared Accounts]
 *     summary: Listar contas compartilhadas (credenciais + ocupação) — ADM only
 *     responses:
 *       200:
 *         description: Lista de contas, com senha descriptografada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *   post:
 *     tags: [Shared Accounts]
 *     summary: Cadastrar conta compartilhada — ADM only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [platformName, email, password]
 *             properties:
 *               platformName: { type: string, example: 'ChatGPT' }
 *               label: { type: string, nullable: true, example: 'Conta 1' }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               loggedInCount: { type: integer, minimum: 0, default: 0 }
 *               lastPaymentDate: { type: string, format: date, nullable: true, description: 'Dia em que o plano foi pago' }
 *               dueDate: { type: string, format: date, nullable: true, description: 'Dia de vencimento da próxima cobrança' }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Conta criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/', controller.list);
router.post('/', validate(createSharedAccountSchema), controller.create);

/**
 * @swagger
 * /shared-accounts/{id}:
 *   put:
 *     tags: [Shared Accounts]
 *     summary: Editar conta compartilhada — ADM only
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
 *               platformName: { type: string }
 *               label: { type: string, nullable: true }
 *               email: { type: string, format: email }
 *               password: { type: string, description: 'Omitir para manter a senha atual' }
 *               loggedInCount: { type: integer, minimum: 0 }
 *               lastPaymentDate: { type: string, format: date, nullable: true }
 *               dueDate: { type: string, format: date, nullable: true }
 *               notes: { type: string, nullable: true }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Conta atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Shared Accounts]
 *     summary: Excluir conta compartilhada — ADM only
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Conta removida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id', validate(updateSharedAccountSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
