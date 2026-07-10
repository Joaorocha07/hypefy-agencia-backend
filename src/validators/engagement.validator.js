const { z } = require('zod');

const setMarginSchema = z.object({
  body: z.object({
    baratosSociaisServiceId: z.string().min(1),
    profitMarginPercent: z.coerce.number().nonnegative(),
  }),
});

module.exports = { setMarginSchema };
