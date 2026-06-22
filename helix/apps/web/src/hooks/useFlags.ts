import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

async function getFlags(): Promise<Record<string, boolean>> {
  const { data } = await api.get<Record<string, boolean>>('/flags');
  return data;
}

export function useFlags(): Record<string, boolean> {
  const { data } = useQuery({
    queryKey: queryKeys.flags.all(),
    queryFn: getFlags,
  });
  return data ?? {};
}
