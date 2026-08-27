const { z } = require('zod');

const createOrderSchema = z.object({
  body: z
    .object({
      productId: z.string().uuid(),
      quantity: z.coerce.number().int().positive().default(1),
      couponCode: z.string().min(3).max(50).optional(),
      targetUsername: z.string().min(1).optional(),
      targetUrl: z.string().url().optional(),
      deviceId: z.string().optional(),
      paymentMethod: z.enum(['PIX', 'CREDIT_CARD']).default('PIX'),
      cardToken: z.string().min(1).optional(),
      cardPaymentMethodId: z.string().min(1).optional(),
      cardIssuerId: z.string().min(1).optional(),
      cardPaymentTypeId: z.enum(['credit_card', 'debit_card']).optional(),
      installments: z.coerce.number().int().positive().optional(),
    })
    .superRefine((body, ctx) => {
      if (body.paymentMethod !== 'CREDIT_CARD') return;
      if (!body.cardToken) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cardToken'], message: 'Token do cartão é obrigatório' });
      }
      if (!body.cardPaymentMethodId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cardPaymentMethodId'],
          message: 'Bandeira do cartão é obrigatória',
        });
      }
      if (!body.installments) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['installments'], message: 'Parcelas são obrigatórias' });
      }
    }),
});

const listOrdersSchema = z.object({
  query: z.object({
    paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
    orderStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

const setManualStartCountSchema = z.object({
  body: z.object({
    startCount: z.coerce.number().int().nonnegative(),
  }),
});

module.exports = { createOrderSchema, listOrdersSchema, setManualStartCountSchema };
