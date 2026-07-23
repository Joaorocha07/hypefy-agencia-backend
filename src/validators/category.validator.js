const { z } = require('zod');

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2),
  }),
});

const reorderCategoriesSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          order: z.number().int().min(0),
        })
      )
      .min(1),
  }),
});

module.exports = { createCategorySchema, updateCategorySchema, reorderCategoriesSchema };
