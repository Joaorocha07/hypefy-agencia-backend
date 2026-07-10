const { z } = require('zod');

const summarySchema = z.object({
  query: z.object({
    period: z.enum(['day', 'week', 'month', 'year']).default('month'),
  }),
});

const reportSchema = z.object({
  query: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    productId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
  }),
});

module.exports = { summarySchema, reportSchema };
