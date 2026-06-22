import { create } from 'zustand';
import { AuthUser } from '@helix/types';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser(user: AuthUser): void;
  logout(): void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,

  setUser(user) {
    set({ user, isAuthenticated: true });
  },

  logout() {
    set({ user: null, isAuthenticated: false });
  },
}));
