import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import {
  createAdminCountry,
  updateAdminCountry,
  deactivateAdminCountry,
  activateAdminCountry,
} from '../api/adminReferenceData.api';
import { CreateCountryDto, UpdateCountryDto } from '@helix/shared';

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.referenceData.adminCountries() }),
      qc.invalidateQueries({ queryKey: queryKeys.countries.all() }),
    ]);
}

export function useCreateCountry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (dto: CreateCountryDto) => createAdminCountry(dto),
    onSuccess: invalidate,
  });
}

export function useUpdateCountry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCountryDto }) =>
      updateAdminCountry(id, dto),
    onSuccess: invalidate,
  });
}

export function useDeactivateCountry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deactivateAdminCountry(id),
    onSuccess: invalidate,
  });
}

export function useActivateCountry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => activateAdminCountry(id),
    onSuccess: invalidate,
  });
}
