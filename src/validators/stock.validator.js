const { z } = require('zod');

const addStockItemsSchema = z.object({
  body: z.object({
    items: z.array(z.string().min(1)).min(1),
  }),
});

const listStockItemsSchema = z.object({
  query: z.object({
    isSold: z
      .preprocess((val) => {
        if (typeof val === 'string') return val === 'true' || val === '1';
        return val;
      }, z.boolean())
      .optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
});

module.exports = { addStockItemsSchema, listStockItemsSchema };
