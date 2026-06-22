import { AuthUser } from '@helix/types';
import { api } from '../../../lib/api';

export interface DevUserDto {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export async function getDevUsers(): Promise<DevUserDto[]> {
  const { data } = await api.get<DevUserDto[]>('/auth/dev-users');
  return data;
}

export async function devLogin(userId: string): Promise<void> {
  await api.post('/auth/dev-login', { userId });
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/auth/me');
  return data;
}
