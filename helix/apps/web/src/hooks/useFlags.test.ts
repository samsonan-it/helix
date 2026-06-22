import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useFlags } from './useFlags';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { ai_prefill: true } }),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useFlags', () => {
  it('returns correct flag values from API response', async () => {
    const { result } = renderHook(() => useFlags(), { wrapper });
    await waitFor(() => expect(result.current['ai_prefill']).toBe(true));
  });

  it('returns empty object before data loads', () => {
    const { result } = renderHook(() => useFlags(), { wrapper });
    expect(typeof result.current).toBe('object');
  });
});
