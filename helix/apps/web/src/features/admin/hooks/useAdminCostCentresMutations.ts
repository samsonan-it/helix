import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import {
  createAdminCostCentre,
  updateAdminCostCentre,
  deactivateAdminCostCentre,
  activateAdminCostCentre,
} from '../api/adminReferenceData.api';
import { CreateCostCentreDto, UpdateCostCentreDto } from '@helix/shared';

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.referenceData.adminCostCentres() }),
      qc.invalidateQueries({ queryKey: queryKeys.costCentres.all() }),
    ]);
}

export function useCreateCostCentre() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (dto: CreateCostCentreDto) => createAdminCostCentre(dto),
    onSuccess: invalidate,
  });
}

export function useUpdateCostCentre() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCostCentreDto }) =>
      updateAdminCostCentre(id, dto),
    onSuccess: invalidate,
  });
}

export function useDeactivateCostCentre() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deactivateAdminCostCentre(id),
    onSuccess: invalidate,
  });
}

export function useActivateCostCentre() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => activateAdminCostCentre(id),
    onSuccess: invalidate,
  });
}
