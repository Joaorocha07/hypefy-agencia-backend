const { z } = require('zod');

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().default(1),
});

const cartQuoteSchema = z.object({
  body: z.object({
    items: z.array(cartItemSchema).min(1, 'Informe ao menos um item'),
    couponCode: z.string().min(3).max(50).optional(),
  }),
});

const checkoutCartSchema = z.object({
  body: z
    .object({
      items: z.array(cartItemSchema).min(1, 'Informe ao menos um item'),
      couponCode: z.string().min(3).max(50).optional(),
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

module.exports = { cartQuoteSchema, checkoutCartSchema };
