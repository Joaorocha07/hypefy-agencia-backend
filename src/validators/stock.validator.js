const { z } = require('zod');

const addStockItemsSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.union([
          z.string().min(1),
          z.object({
            content: z.string().min(1),
            quantidade: z.coerce.number().int().positive().default(1),
            pin: z.string().optional(),
          }),
        ])
      )
      .min(1),
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

const updateStockItemSchema = z.object({
  body: z.object({
    content: z.string().min(1),
    quantidade: z.coerce.number().int().positive().optional(),
  }),
});

const notifyAccessUpdateSchema = z.object({
  body: z.object({
    content: z.string().min(1),
    orderIds: z.array(z.string().uuid()).min(1).optional(),
  }),
});

const updateScreenPinSchema = z.object({
  body: z.object({
    pin: z.string().nullable().optional(),
  }),
});

const addManualStockSchema = z.object({
  body: z.object({
    quantity: z.coerce.number().int().positive().max(1000),
  }),
});

const setManualCostSchema = z.object({
  body: z.object({
    manualCostPrice: z.coerce.number().nonnegative().nullable(),
  }),
});

module.exports = {
  addStockItemsSchema,
  listStockItemsSchema,
  updateStockItemSchema,
  updateScreenPinSchema,
  notifyAccessUpdateSchema,
  addManualStockSchema,
  setManualCostSchema,
};
