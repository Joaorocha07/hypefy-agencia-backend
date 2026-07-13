const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const reviewService = require('../services/review.service');

const list = asyncHandler(async (req, res) => {
  const result = await reviewService.listReviews(req.params.id, req.query, req.user?.id);
  success(res, result);
});

const upsert = asyncHandler(async (req, res) => {
  const review = await reviewService.upsertReview(req.user.id, req.params.id, req.body);
  success(res, review, 'Avaliação registrada com sucesso');
});

const reply = asyncHandler(async (req, res) => {
  const review = await reviewService.replyToReview(req.params.reviewId, req.body.reply);
  success(res, review, 'Resposta registrada com sucesso');
});

module.exports = { list, upsert, reply };
