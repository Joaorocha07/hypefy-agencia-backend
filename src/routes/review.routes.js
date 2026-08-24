const { Router } = require('express');
const controller = require('../controllers/review.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize, attachMenu } = require('../middlewares/auth');
const { adminReplySchema } = require('../validators/review.validator');

const router = Router();

// Respostas de review são geridas junto do menu "produtos".
router.use(attachMenu('produtos'));

/**
 * @swagger
 * /reviews/{reviewId}/reply:
 *   patch:
 *     tags: [Reviews]
 *     summary: Responder a uma avaliação de cliente (ADM/FUNC)
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reply]
 *             properties:
 *               reply: { type: string, maxLength: 1000 }
 *     responses:
 *       200:
 *         description: Resposta registrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch('/:reviewId/reply', authenticate, authorize('ADM', 'FUNC'), validate(adminReplySchema), controller.reply);

module.exports = router;
