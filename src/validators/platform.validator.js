const { z } = require('zod');

const hexColor = z.preprocess(
  (val) => (val === '' || val === undefined ? undefined : val),
  z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser um hexadecimal no formato #RRGGBB').optional()
);

const createPlatformSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    color: hexColor,
  }),
});

const updatePlatformSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    color: hexColor,
  }),
});

module.exports = { createPlatformSchema, updatePlatformSchema };
