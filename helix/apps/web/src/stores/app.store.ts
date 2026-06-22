import { create } from 'zustand';

export interface PendingAction {
  id: string;
  onExpire: () => Promise<void>;
  onUndo: () => void;
  expiresAt: number;
  timerId: ReturnType<typeof setTimeout> | null;
}

interface AppState {
  pendingAction: PendingAction | null;
  setPendingAction(action: Omit<PendingAction, 'timerId'>): void;
  clearPendingAction(): void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  pendingAction: null,

  setPendingAction(action) {
    const existing = get().pendingAction;
    if (existing?.timerId) clearTimeout(existing.timerId);

    const delay = action.expiresAt - Date.now();
    const timerId = setTimeout(() => {
      const current = get().pendingAction;
      if (current?.id === action.id) {
        set({ pendingAction: null });
        action.onExpire();
      }
    }, Math.max(delay, 0));

    set({ pendingAction: { ...action, timerId } });
  },

  clearPendingAction() {
    const existing = get().pendingAction;
    if (existing?.timerId) clearTimeout(existing.timerId);
    set({ pendingAction: null });
  },
}));
