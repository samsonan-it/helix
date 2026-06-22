import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { devLogin, getDevUsers, getMe } from '../api/authApi';
import { useAuthStore } from '../../../stores/auth.store';
import { queryKeys } from '../../../lib/queryKeys';

export function useDevUsers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.auth.devUsers(),
    queryFn: getDevUsers,
    enabled: options?.enabled ?? true,
  });
}

export function useDevLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => devLogin(userId),
    onSuccess() {
      void queryClient.resetQueries({ queryKey: queryKeys.auth.me() });
      void navigate('/');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const apiUrl = import.meta.env.VITE_API_URL;

  return useMutation({
    mutationFn: async () => {
      useAuthStore.getState().logout();
      queryClient.clear();
      window.location.href = `${apiUrl}/auth/logout`;
    },
  });
}

export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser);

  // 401 redirect is handled globally by the api.ts response interceptor.
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () =>
      getMe().then((user) => {
        setUser(user);
        return user;
      }),
    retry: false,
  });
}
