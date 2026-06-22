import { api } from './api';

export interface UserPickerItem {
  id: string;
  name: string;
  email: string;
}

export async function getUsersByRole(role: string): Promise<UserPickerItem[]> {
  const { data } = await api.get<UserPickerItem[]>('/users', { params: { role } });
  return data;
}
