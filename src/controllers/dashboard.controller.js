const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboard.service');

// Sócio só enxerga faturamento a partir da data configurada pelo admin
// master (req.user.financialVisibleFrom) — ADM/FUNC não têm esse corte.
function visibleFromFor(req) {
  return req.user.role === 'SOCIO' ? req.user.financialVisibleFrom : null;
}

const summary = asyncHandler(async (req, res) => {
  const result = await dashboardService.getSummary(req.query.period, visibleFromFor(req));
  success(res, result);
});

const report = asyncHandler(async (req, res) => {
  const result = await dashboardService.getDetailedReport(req.query, visibleFromFor(req));
  success(res, result);
});

module.exports = { summary, report };
