const { z } = require('zod');
const { ADMIN_MENUS } = require('../utils/menus');

const menuEnum = z.enum(ADMIN_MENUS);
const profitSharePercentSchema = z.coerce.number().min(0).max(100);

const promotePartnerSchema = z.object({
  body: z.object({
    customerId: z.string().uuid(),
    allowedMenus: z.array(menuEnum).optional(),
    financialVisibleFrom: z.coerce.date().nullable().optional(),
    profitSharePercent: profitSharePercentSchema.optional(),
  }),
});

const setActiveSchema = z.object({
  body: z.object({
    isActive: z.preprocess((val) => (typeof val === 'string' ? val === 'true' || val === '1' : val), z.boolean()),
  }),
});

const updatePermissionsSchema = z.object({
  body: z.object({
    allowedMenus: z.array(menuEnum).optional(),
    financialVisibleFrom: z.coerce.date().nullable().optional(),
    profitSharePercent: profitSharePercentSchema.optional(),
  }),
});

module.exports = { promotePartnerSchema, setActiveSchema, updatePermissionsSchema };
