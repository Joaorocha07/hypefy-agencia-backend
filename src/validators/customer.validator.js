const { z } = require('zod');

const listCustomersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
});

module.exports = {
  listCustomersSchema,
};
