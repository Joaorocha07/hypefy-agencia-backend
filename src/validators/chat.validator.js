const { z } = require('zod');

const sendMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(4000),
  }),
});

module.exports = { sendMessageSchema };
