const prisma = require('../config/db');
const AppError = require('../utils/appError');

const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const REVIEW_USER_SELECT = { id: true, name: true, avatarUrl: true };

function toPublicReview(review, viewerId) {
  const isOwn = Boolean(viewerId) && viewerId === review.userId;
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    adminReply: review.adminReply,
    adminRepliedAt: review.adminRepliedAt,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isOwn,
    canEdit: isOwn && Date.now() - new Date(review.createdAt).getTime() < EDIT_WINDOW_MS,
    user: review.user,
  };
}

async function hasVerifiedPurchase(userId, productId) {
  const order = await prisma.order.findFirst({
    where: { userId, productId, paymentStatus: 'PAID', orderStatus: 'COMPLETED' },
  });
  return Boolean(order);
}

async function listReviews(productId, { page = 1, limit = 5, sort = 'recent' }, viewerId) {
  const orderBy =
    sort === 'rating_desc' ? { rating: 'desc' } : sort === 'rating_asc' ? { rating: 'asc' } : { createdAt: 'desc' };

  const [items, total, aggregate, distributionRaw, myReview] = await Promise.all([
    prisma.review.findMany({
      where: { productId },
      include: { user: { select: REVIEW_USER_SELECT } },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where: { productId } }),
    prisma.review.aggregate({ where: { productId }, _avg: { rating: true } }),
    prisma.review.groupBy({ by: ['rating'], where: { productId }, _count: { rating: true } }),
    viewerId
      ? prisma.review.findUnique({
          where: { userId_productId: { userId: viewerId, productId } },
          include: { user: { select: REVIEW_USER_SELECT } },
        })
      : Promise.resolve(null),
  ]);

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const row of distributionRaw) distribution[row.rating] = row._count.rating;

  const canReview = viewerId ? !myReview && (await hasVerifiedPurchase(viewerId, productId)) : false;

  return {
    items: items.map((review) => toPublicReview(review, viewerId)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    average: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(2)) : 0,
    distribution,
    myReview: myReview ? toPublicReview(myReview, viewerId) : null,
    canReview,
  };
}

async function upsertReview(userId, productId, { rating, comment }) {
  const verified = await hasVerifiedPurchase(userId, productId);
  if (!verified) throw new AppError('Você só pode avaliar produtos que comprou e recebeu.', 403);

  const existing = await prisma.review.findUnique({ where: { userId_productId: { userId, productId } } });

  if (existing) {
    const withinWindow = Date.now() - new Date(existing.createdAt).getTime() < EDIT_WINDOW_MS;
    if (!withinWindow) throw new AppError('O prazo de 7 dias para editar sua avaliação já passou.', 403);

    const updated = await prisma.review.update({
      where: { id: existing.id },
      data: { rating, comment },
      include: { user: { select: REVIEW_USER_SELECT } },
    });
    return toPublicReview(updated, userId);
  }

  const created = await prisma.review.create({
    data: { productId, userId, rating, comment },
    include: { user: { select: REVIEW_USER_SELECT } },
  });
  return toPublicReview(created, userId);
}

async function replyToReview(reviewId, reply) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new AppError('Avaliação não encontrada', 404);

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { adminReply: reply, adminRepliedAt: new Date() },
    include: { user: { select: REVIEW_USER_SELECT } },
  });
  return toPublicReview(updated, null);
}

module.exports = { listReviews, upsertReview, replyToReview, hasVerifiedPurchase };
