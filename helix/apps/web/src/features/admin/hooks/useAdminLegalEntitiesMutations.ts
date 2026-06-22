import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import {
  createAdminLegalEntity,
  updateAdminLegalEntity,
  deactivateAdminLegalEntity,
  activateAdminLegalEntity,
} from '../api/adminReferenceData.api';
import { CreateLegalEntityDto, UpdateLegalEntityDto } from '@helix/shared';

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.referenceData.adminLegalEntities() }),
      qc.invalidateQueries({ queryKey: queryKeys.legalEntities.all() }),
    ]);
}

export function useCreateLegalEntity() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (dto: CreateLegalEntityDto) => createAdminLegalEntity(dto),
    onSuccess: invalidate,
  });
}

export function useUpdateLegalEntity() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateLegalEntityDto }) =>
      updateAdminLegalEntity(id, dto),
    onSuccess: invalidate,
  });
}

export function useDeactivateLegalEntity() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deactivateAdminLegalEntity(id),
    onSuccess: invalidate,
  });
}

export function useActivateLegalEntity() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => activateAdminLegalEntity(id),
    onSuccess: invalidate,
  });
}
