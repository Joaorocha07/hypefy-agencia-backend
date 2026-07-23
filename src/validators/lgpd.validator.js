const { z } = require('zod');

const REQUEST_TYPES = [
  'confirmacao',
  'acesso',
  'correcao',
  'exclusao',
  'portabilidade',
  'anonimizacao',
  'revogacao',
  'compartilhamentos',
  'outro',
];

const createLgpdRequestSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    cpf: z.string().optional(),
    type: z.enum(REQUEST_TYPES),
    message: z.string().optional(),
  }),
});

module.exports = { createLgpdRequestSchema };
