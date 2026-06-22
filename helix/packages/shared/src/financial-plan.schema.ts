import { z } from 'zod';
import { glAccountCategorySchema } from './gl-account.schema';

// All monetary values are integer euro cents. NEVER floats.
// e.g. €400.00 is stored/transmitted as 40000
// Max 2_100_000_000 cents = €21M (Postgres INTEGER ceiling; BIGINT migration deferred)
export const monetaryValueSchema = z.number().int().nonnegative().max(2_100_000_000);
export type MonetaryValue = z.infer<typeof monetaryValueSchema>;

// One row in the financial grid — a (glAccount, category) pair.
// Mixed accounts (categories: ['opex','capex']) expand into two rows.
export const financialGlAccountSchema = z.object({
  id:       z.string(),
  category: glAccountCategorySchema,
  label:    z.string(),
  isActive: z.boolean(),
});
export type FinancialGlAccount = z.infer<typeof financialGlAccountSchema>;

export const financialPlanEntrySchema = z.object({
  id:          z.string(),
  glAccountId: z.string(),
  category:    glAccountCategorySchema,
  month:       z.number().int().min(1).max(12),
  year:        z.number().int().min(2020).max(2100),
  valueCents:  monetaryValueSchema,
  isActual:    z.boolean(),
  isUserSet:   z.boolean(),
});
export type FinancialPlanEntry = z.infer<typeof financialPlanEntrySchema>;

export const financialPlanResponseSchema = z.object({
  glAccounts: z.array(financialGlAccountSchema),
  entries:    z.array(financialPlanEntrySchema),
});
export type FinancialPlanResponse = z.infer<typeof financialPlanResponseSchema>;

export const updateFinancialPlanEntryItemSchema = z.object({
  glAccountId: z.string(),
  category:    glAccountCategorySchema,
  month:       z.number().int().min(1).max(12),
  year:        z.number().int().min(2020).max(2100),
  valueCents:  monetaryValueSchema,
});
export type UpdateFinancialPlanEntryItem = z.infer<typeof updateFinancialPlanEntryItemSchema>;

export const updateFinancialPlanEntriesSchema = z.object({
  entries: z.array(updateFinancialPlanEntryItemSchema).min(1),
});
export type UpdateFinancialPlanEntriesDto = z.infer<typeof updateFinancialPlanEntriesSchema>;
