const { Router } = require('express');
const controller = require('../controllers/employee.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize, attachMenu } = require('../middlewares/auth');
const { createEmployeeSchema, setActiveSchema } = require('../validators/employee.validator');

const router = Router();

// Gestão de funcionários é exclusiva do ADM
router.use(authenticate, attachMenu('funcionarios'), authorize('ADM'));

/**
 * @swagger
 * /employees:
 *   post:
 *     tags: [Employees]
 *     summary: Cadastrar funcionário (role FUNC) — ADM only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, temporaryPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               name: { type: string }
 *               phone: { type: string }
 *               temporaryPassword: { type: string, minLength: 6 }
 *     responses:
 *       201:
 *         description: Funcionário criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { description: 'Email já cadastrado', content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *   get:
 *     tags: [Employees]
 *     summary: Listar funcionários — ADM only
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Lista de funcionários
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/', validate(createEmployeeSchema), controller.create);
router.get('/', controller.list);

/**
 * @swagger
 * /employees/{id}/active:
 *   patch:
 *     tags: [Employees]
 *     summary: Ativar/inativar funcionário — ADM only
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
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/active', validate(setActiveSchema), controller.setActive);

module.exports = router;
