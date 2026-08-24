const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize, attachMenu } = require('../middlewares/auth');
const { summarySchema, reportSchema } = require('../validators/dashboard.validator');

const router = Router();

// Faturamento/lucro são exclusivos do ADM (FUNC não pode ver relatórios financeiros)
// — SOCIO entra se tiver o menu "dashboard" liberado (ver authorize/attachMenu).
router.use(authenticate, attachMenu('dashboard'), authorize('ADM'));

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Resumo de faturamento (total vendido, nº de pedidos, ticket médio, lucro líquido) — ADM only
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [day, week, month, year], default: month }
 *     responses:
 *       200:
 *         description: 'Resumo do período: totalSales, orderCount, averageTicket, revenue, costs, refunds, netProfit'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/summary', validate(summarySchema), controller.summary);

/**
 * @swagger
 * /dashboard/report:
 *   get:
 *     tags: [Dashboard]
 *     summary: Relatório detalhado de vendas por produto/período/cliente — ADM only
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: productId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de pedidos pagos no filtro + receita total
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/report', validate(reportSchema), controller.report);

module.exports = router;
