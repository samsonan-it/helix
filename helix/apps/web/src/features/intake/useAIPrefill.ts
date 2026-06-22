import { useState } from 'react';
import { UseFormSetValue, UseFormGetValues } from 'react-hook-form';
import { api } from '../../lib/api';
import { DemandFormValues, AIPrefillResponse } from '@helix/shared';

interface UseAIPrefillOptions {
  flags: Record<string, boolean>;
  setValue: UseFormSetValue<DemandFormValues>;
  getValues: UseFormGetValues<DemandFormValues>;
  validCostCentreIds?: Set<string>;
}

interface UseAIPrefillResult {
  triggerPrefill: (description: string) => Promise<void>;
  isLoading: boolean;
  prefillFailed: boolean;
  aiSuggestedFields: Set<keyof DemandFormValues>;
  clearAISuggested: (field: keyof DemandFormValues) => void;
  markAISuggested: (field: keyof DemandFormValues) => void;
  aiConfidence: Partial<NonNullable<AIPrefillResponse['confidence']>>;
  estimatedCostCents: number | null;
}

const APPLYABLE_FIELDS: Array<keyof DemandFormValues> = [
  'title',
  'description',
  'objective',
  'necessity',
  'benefitsObjectives',
];

export function useAIPrefill({
  flags,
  setValue,
  getValues,
  validCostCentreIds,
}: UseAIPrefillOptions): UseAIPrefillResult {
  const [isLoading, setIsLoading] = useState(false);
  const [prefillFailed, setPrefillFailed] = useState(false);
  const [aiSuggestedFields, setAiSuggestedFields] = useState<Set<keyof DemandFormValues>>(new Set());
  const [aiConfidence, setAiConfidence] = useState<Partial<NonNullable<AIPrefillResponse['confidence']>>>({});
  const [estimatedCostCents, setEstimatedCostCents] = useState<number | null>(null);

  async function triggerPrefill(description: string): Promise<void> {
    if (!flags['ai_prefill']) return;

    setIsLoading(true);
    setPrefillFailed(false);

    try {
      const { data } = await api.post<AIPrefillResponse>('/demands/prefill', { description });

      const fieldsToAdd: Array<keyof DemandFormValues> = [];
      const currentValues = getValues();

      for (const field of APPLYABLE_FIELDS) {
        const value = (data as Record<string, unknown>)[field];
        if (value != null) {
          const currentVal = currentValues[field];
          if (!currentVal) {
            setValue(field, value as never);
            fieldsToAdd.push(field);
          }
        }
      }

      if (data.costCentreId && (!validCostCentreIds || validCostCentreIds.has(data.costCentreId))) {
        const currentCostCentre = currentValues.costCentreId;
        if (!currentCostCentre) {
          setValue('costCentreId', data.costCentreId);
          fieldsToAdd.push('costCentreId');
        }
      }

      setAiSuggestedFields((prev) => {
        const next = new Set(prev);
        for (const f of fieldsToAdd) next.add(f);
        return next;
      });
      setAiConfidence(data.confidence ?? {});
      setEstimatedCostCents(data.estimatedCostCents ?? null);
    } catch {
      setPrefillFailed(true);
    } finally {
      setIsLoading(false);
    }
  }

  function clearAISuggested(field: keyof DemandFormValues) {
    setAiSuggestedFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  function markAISuggested(field: keyof DemandFormValues) {
    setAiSuggestedFields((prev) => new Set([...prev, field]));
  }

  return {
    triggerPrefill,
    isLoading,
    prefillFailed,
    aiSuggestedFields,
    clearAISuggested,
    markAISuggested,
    aiConfidence,
    estimatedCostCents,
  };
}
