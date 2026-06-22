import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import {
  createAdminArea,
  updateAdminArea,
  deactivateAdminArea,
  activateAdminArea,
} from '../api/adminReferenceData.api';
import { CreateAreaDto, UpdateAreaDto } from '@helix/shared';

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.referenceData.adminAreas() }),
      qc.invalidateQueries({ queryKey: queryKeys.areas.all() }),
    ]);
}

export function useCreateArea() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (dto: CreateAreaDto) => createAdminArea(dto),
    onSuccess: invalidate,
  });
}

export function useUpdateArea() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAreaDto }) =>
      updateAdminArea(id, dto),
    onSuccess: invalidate,
  });
}

export function useDeactivateArea() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deactivateAdminArea(id),
    onSuccess: invalidate,
  });
}

export function useActivateArea() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => activateAdminArea(id),
    onSuccess: invalidate,
  });
}
