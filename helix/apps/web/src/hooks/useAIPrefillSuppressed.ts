import { useState } from 'react';

const STORAGE_KEY = (userId: string) => `helix_ai_prefill_suppress_${userId}`;

export function useAIPrefillSuppressed(userId: string): {
  isSuppressed: boolean;
  suppress: () => void;
} {
  const [isSuppressed, setIsSuppressed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY(userId)) === 'true';
  });

  function suppress() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY(userId), 'true');
    }
    setIsSuppressed(true);
  }

  return { isSuppressed, suppress };
}
