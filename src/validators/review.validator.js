const { z } = require('zod');

const listReviewsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
    sort: z.enum(['recent', 'rating_desc', 'rating_asc']).optional(),
  }),
});

const upsertReviewSchema = z.object({
  body: z.object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  }),
});

const adminReplySchema = z.object({
  body: z.object({
    reply: z.string().min(1).max(1000),
  }),
});

module.exports = { listReviewsSchema, upsertReviewSchema, adminReplySchema };
