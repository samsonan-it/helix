import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import {
  createAdminGlAccount,
  updateAdminGlAccount,
  deactivateAdminGlAccount,
  activateAdminGlAccount,
} from '../api/adminReferenceData.api';
import { CreateGlAccountDto, UpdateGlAccountDto } from '@helix/shared';

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.referenceData.adminGlAccounts() }),
      qc.invalidateQueries({ queryKey: queryKeys.glAccounts.all() }),
    ]);
}

export function useCreateGlAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (dto: CreateGlAccountDto) => createAdminGlAccount(dto),
    onSuccess: invalidate,
  });
}

export function useUpdateGlAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateGlAccountDto }) =>
      updateAdminGlAccount(id, dto),
    onSuccess: invalidate,
  });
}

export function useDeactivateGlAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deactivateAdminGlAccount(id),
    onSuccess: invalidate,
  });
}

export function useActivateGlAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => activateAdminGlAccount(id),
    onSuccess: invalidate,
  });
}
