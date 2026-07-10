const { z } = require('zod');

const createEmployeeSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().min(2),
    phone: z.string().min(8).optional(),
    temporaryPassword: z.string().min(6),
  }),
});

const setActiveSchema = z.object({
  body: z.object({
    isActive: z.preprocess((val) => (typeof val === 'string' ? val === 'true' || val === '1' : val), z.boolean()),
  }),
});

module.exports = { createEmployeeSchema, setActiveSchema };
