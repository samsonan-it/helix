import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIPrefillSuppressed } from './useAIPrefillSuppressed';

const store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
  length: 0,
  key: () => null,
};

beforeEach(() => {
  mockLocalStorage.clear();
  vi.stubGlobal('localStorage', mockLocalStorage);
});

describe('useAIPrefillSuppressed', () => {
  it('returns isSuppressed=false initially when no localStorage key set', () => {
    const { result } = renderHook(() => useAIPrefillSuppressed('user-1'));
    expect(result.current.isSuppressed).toBe(false);
  });

  it('suppress() writes key and isSuppressed becomes true', () => {
    const { result } = renderHook(() => useAIPrefillSuppressed('user-1'));
    act(() => result.current.suppress());
    expect(result.current.isSuppressed).toBe(true);
    expect(mockLocalStorage.getItem('helix_ai_prefill_suppress_user-1')).toBe('true');
  });

  it('reads true from localStorage on mount when key is already set', () => {
    mockLocalStorage.setItem('helix_ai_prefill_suppress_user-2', 'true');
    const { result } = renderHook(() => useAIPrefillSuppressed('user-2'));
    expect(result.current.isSuppressed).toBe(true);
  });

  it('uses separate key per userId', () => {
    mockLocalStorage.setItem('helix_ai_prefill_suppress_user-A', 'true');
    const { result: resultA } = renderHook(() => useAIPrefillSuppressed('user-A'));
    const { result: resultB } = renderHook(() => useAIPrefillSuppressed('user-B'));
    expect(resultA.current.isSuppressed).toBe(true);
    expect(resultB.current.isSuppressed).toBe(false);
  });
});
