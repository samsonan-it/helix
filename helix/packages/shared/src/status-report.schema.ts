import { z } from 'zod';

export const RAG_VALUES = ['GREEN', 'AMBER', 'RED'] as const;
export type RagValue = (typeof RAG_VALUES)[number];

const ragField = () => z.enum(RAG_VALUES);
const explanationField = () => z.string().nullable().optional();

export const createStatusReportSchema = z
  .object({
    overallRag:        ragField(),
    scheduleRag:       ragField(),
    resourcesRag:      ragField(),
    budgetCurrentRag:  ragField(),
    budgetForecastRag: ragField(),
    stakeholdersRag:   ragField(),
    valuePropRag:      ragField(),
    providerRag:       ragField(),

    overallExplanation:        explanationField(),
    scheduleExplanation:       explanationField(),
    resourcesExplanation:      explanationField(),
    budgetCurrentExplanation:  explanationField(),
    budgetForecastExplanation: explanationField(),
    stakeholdersExplanation:   explanationField(),
    valuePropExplanation:      explanationField(),
    providerExplanation:       explanationField(),

    keyAccomplishments: z.string().nullable().optional(),
    nextSteps:          z.string().nullable().optional(),
    goLiveDate:         z.string().datetime({ offset: true }).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const pairs: Array<[keyof typeof data, keyof typeof data]> = [
      ['overallRag', 'overallExplanation'],
      ['scheduleRag', 'scheduleExplanation'],
      ['resourcesRag', 'resourcesExplanation'],
      ['budgetCurrentRag', 'budgetCurrentExplanation'],
      ['budgetForecastRag', 'budgetForecastExplanation'],
      ['stakeholdersRag', 'stakeholdersExplanation'],
      ['valuePropRag', 'valuePropExplanation'],
      ['providerRag', 'providerExplanation'],
    ];
    for (const [ragKey, explKey] of pairs) {
      if (data[ragKey] !== 'GREEN' && !data[explKey]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [explKey],
          message: `Explanation required when RAG is non-green`,
        });
      }
    }
  });

export type CreateStatusReportDto = z.infer<typeof createStatusReportSchema>;
