const { z } = require('zod');

const createGuestOrderSchema = z.object({
  body: z
    .object({
      // Produto principal + order bumps opcionais — todos num único pagamento.
      productIds: z.array(z.string().uuid()).min(1).max(5),
      email: z.string().trim().email().max(254),
      cpf: z.string().min(11).max(14),
      deviceId: z.string().optional(),
      // Mesmos campos de cartão de createOrderSchema — gerados no client pelo
      // Card Payment Brick, nunca dados de cartão em texto puro.
      paymentMethod: z.enum(['PIX', 'CREDIT_CARD']).default('PIX'),
      cardToken: z.string().min(1).optional(),
      cardPaymentMethodId: z.string().min(1).optional(),
      cardIssuerId: z.string().min(1).optional(),
      cardPaymentTypeId: z.enum(['credit_card', 'debit_card']).optional(),
      installments: z.coerce.number().int().min(1).max(12).optional(),
    })
    .superRefine((body, ctx) => {
      if (body.paymentMethod !== 'CREDIT_CARD') return;
      for (const field of ['cardToken', 'cardPaymentMethodId', 'installments']) {
        if (!body[field]) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Dados do cartão incompletos' });
        }
      }
    }),
});

const guestOrderStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({ token: z.string().min(1).max(100) }),
});

module.exports = { createGuestOrderSchema, guestOrderStatusSchema };
