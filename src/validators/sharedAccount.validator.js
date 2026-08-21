const { z } = require('zod');

// Aceita "YYYY-MM-DD" (input type=date do frontend) ou ISO completo; string
// vazia é permitida e tratada como "sem data" (ver sharedAccount.service.js).
const dateStringSchema = z.string().refine((v) => v === '' || !isNaN(Date.parse(v)), 'Data inválida');

const createSharedAccountSchema = z.object({
  body: z.object({
    platformName: z.string().min(1),
    label: z.string().optional(),
    email: z.string().email(),
    password: z.string().min(1),
    loggedInCount: z.number().int().min(0).optional(),
    lastPaymentDate: dateStringSchema.optional(),
    dueDate: dateStringSchema.optional(),
    notes: z.string().optional(),
  }),
});

const updateSharedAccountSchema = z.object({
  body: z.object({
    platformName: z.string().min(1).optional(),
    label: z.string().optional(),
    email: z.string().email().optional(),
    // Vazio/ausente = mantém a senha atual (ver sharedAccount.service.js#updateAccount).
    password: z.string().optional(),
    loggedInCount: z.number().int().min(0).optional(),
    lastPaymentDate: dateStringSchema.optional(),
    dueDate: dateStringSchema.optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

module.exports = { createSharedAccountSchema, updateSharedAccountSchema };
