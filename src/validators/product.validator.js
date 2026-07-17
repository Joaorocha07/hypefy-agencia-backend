const { z } = require('zod');

const zBoolLike = z.preprocess((val) => {
  if (typeof val === 'string') return val === 'true' || val === '1';
  return val;
}, z.boolean());

const createProductSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    price: z.coerce.number().positive(),
    costPrice: z.coerce.number().nonnegative().optional(),
    categoryId: z.string().uuid(),
    platformId: z.string().uuid(),
    baratosSociaisServiceId: z.string().optional(),
    profitMarginPercent: z.coerce.number().nonnegative().optional(),
    accessDurationDays: z.coerce.number().int().positive().optional(),
    isFeatured: zBoolLike.optional(),
  }),
});

const updateProductSchema = z.object({
  body: z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    price: z.coerce.number().positive().optional(),
    costPrice: z.coerce.number().nonnegative().optional(),
    categoryId: z.string().uuid().optional(),
    platformId: z.string().uuid().optional(),
    baratosSociaisServiceId: z.string().optional(),
    profitMarginPercent: z.coerce.number().nonnegative().optional(),
    accessDurationDays: z.coerce.number().int().positive().optional(),
    isActive: zBoolLike.optional(),
    isFeatured: zBoolLike.optional(),
  }),
});

const listProductsSchema = z.object({
  query: z.object({
    categoryId: z.string().uuid().optional(),
    platformId: z.string().uuid().optional(),
    isActive: zBoolLike.optional(),
    isFeatured: zBoolLike.optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

const setActiveSchema = z.object({
  body: z.object({
    isActive: zBoolLike,
  }),
});

const setFeaturedSchema = z.object({
  body: z.object({
    isFeatured: zBoolLike,
  }),
});

const quoteSchema = z.object({
  query: z.object({
    quantity: z.coerce.number().int().positive(),
  }),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  setActiveSchema,
  setFeaturedSchema,
  quoteSchema,
};
