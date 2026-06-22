import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { updateUserRoles } from '../api/admin.api';
import { UpdateUserRolesDto } from '@helix/shared';

export function useUpdateUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, dto }: { userId: string; dto: UpdateUserRolesDto }) =>
      updateUserRoles(userId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.routingHealth() });
    },
  });
}
