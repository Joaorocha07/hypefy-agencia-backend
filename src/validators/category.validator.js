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

module.exports = { createCategorySchema, updateCategorySchema };
