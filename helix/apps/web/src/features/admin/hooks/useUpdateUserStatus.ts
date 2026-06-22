import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { updateAdminUserStatus } from '../api/admin.api';
import { UpdateUserStatusDto } from '@helix/shared';

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, dto }: { userId: string; dto: UpdateUserStatusDto }) =>
      updateAdminUserStatus(userId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    },
  });
}
