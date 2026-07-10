const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboard.service');

const summary = asyncHandler(async (req, res) => {
  const result = await dashboardService.getSummary(req.query.period);
  success(res, result);
});

const report = asyncHandler(async (req, res) => {
  const result = await dashboardService.getDetailedReport(req.query);
  success(res, result);
});

module.exports = { summary, report };
