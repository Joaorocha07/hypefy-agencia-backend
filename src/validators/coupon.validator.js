const { z } = require('zod');

const createCouponSchema = z.object({
  body: z.object({
    code: z.string().min(3).max(50).toUpperCase(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
    discountValue: z.coerce.number().positive(),
    maxUses: z.coerce.number().int().positive().optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
  }),
});

const updateCouponSchema = z.object({
  body: z.object({
    discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    discountValue: z.coerce.number().positive().optional(),
    maxUses: z.coerce.number().int().positive().optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    isActive: z
      .preprocess((val) => (typeof val === 'string' ? val === 'true' || val === '1' : val), z.boolean())
      .optional(),
  }),
});

module.exports = { createCouponSchema, updateCouponSchema };
