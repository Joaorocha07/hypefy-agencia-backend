const { z } = require('zod');

const createManualPixPaymentSchema = z.object({
  body: z.object({
    customerName: z.string().trim().min(1, 'Nome do cliente é obrigatório').max(120),
    customerPhone: z.string().trim().min(1, 'Telefone do cliente é obrigatório').max(30),
    amount: z.coerce.number().positive('Valor deve ser maior que zero'),
    // O front manda null (não omite a chave) quando o campo fica em branco —
    // .optional() sozinho só aceita a chave ausente/undefined, então precisa
    // de .nullable() também, senão o zod rejeita a requisição inteira.
    productId: z.string().uuid().nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  }),
});

const updateManualPixPaymentSchema = z.object({
  body: z.object({
    customerName: z.string().trim().min(1).max(120).optional(),
    customerPhone: z.string().trim().min(1).max(30).optional(),
    amount: z.coerce.number().positive().optional(),
    productId: z.string().uuid().nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  }),
});

const listManualPixPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    productId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

module.exports = { createManualPixPaymentSchema, updateManualPixPaymentSchema, listManualPixPaymentsSchema };
