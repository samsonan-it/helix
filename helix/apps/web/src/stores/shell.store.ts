import { create } from 'zustand';

interface ShellState {
  navbarOpen: boolean;
  setNavbarOpen(open: boolean): void;
  toggleNavbar(): void;
}

export const useShellStore = create<ShellState>()((set) => ({
  navbarOpen: true,
  setNavbarOpen(open) {
    set({ navbarOpen: open });
  },
  toggleNavbar() {
    set((s) => ({ navbarOpen: !s.navbarOpen }));
  },
}));
