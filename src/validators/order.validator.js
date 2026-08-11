const { z } = require('zod');

const createOrderSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().positive().default(1),
    couponCode: z.string().min(3).max(50).optional(),
    targetUsername: z.string().min(1).optional(),
    targetUrl: z.string().url().optional(),
    deviceId: z.string().optional(),
  }),
});

const listOrdersSchema = z.object({
  query: z.object({
    paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
    orderStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

const setManualStartCountSchema = z.object({
  body: z.object({
    startCount: z.coerce.number().int().nonnegative(),
  }),
});

module.exports = { createOrderSchema, listOrdersSchema, setManualStartCountSchema };
