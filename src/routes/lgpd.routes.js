const { Router } = require('express');
const controller = require('../controllers/lgpd.controller');
const validate = require('../middlewares/validate');
const { authRateLimiter } = require('../middlewares/rateLimit');
const { createLgpdRequestSchema } = require('../validators/lgpd.validator');

const router = Router();

/**
 * @swagger
 * /lgpd/requests:
 *   post:
 *     tags: [LGPD]
 *     summary: Registrar solicitação de direitos do titular (LGPD)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, type]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               cpf: { type: string }
 *               type: { type: string, enum: [confirmacao, acesso, correcao, exclusao, portabilidade, anonimizacao, revogacao, compartilhamentos, outro] }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Solicitação registrada — retorna o protocolo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/requests', authRateLimiter, validate(createLgpdRequestSchema), controller.createRequest);

module.exports = router;
