import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useGetSystemSettings } from './intake.queries';
import { queryKeys } from '../../lib/queryKeys';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../../lib/api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const VALID_RESPONSE = {
  spThresholdEurCents:   5_000_000,
  intakeWindowStart:     null,
  intakeWindowEnd:       null,
  budgetCycleStart:      null,
  budgetCycleEnd:        null,
  gxpItValidationDays:   30,
  gxpDocumentationDays:  14,
};

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useGetSystemSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses systemSettings.all() as the query key', async () => {
    mockApi.get.mockResolvedValue({ data: VALID_RESPONSE });
    const { result } = renderHook(() => useGetSystemSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/config/system-settings');
    expect(queryKeys.systemSettings.all()).toEqual(['system-settings']);
  });

  it('returns full 7-field response on success', async () => {
    mockApi.get.mockResolvedValue({ data: VALID_RESPONSE });
    const { result } = renderHook(() => useGetSystemSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.spThresholdEurCents).toBe(5_000_000);
    expect(result.current.data?.intakeWindowStart).toBeNull();
  });

  it('returns default settings when fetch fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useGetSystemSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.gxpItValidationDays).toBe(30);
    expect(result.current.data?.gxpDocumentationDays).toBe(14);
    expect(result.current.data?.spThresholdEurCents).toBe(5_000_000);
  });

  it('returns default settings when response fails schema validation', async () => {
    mockApi.get.mockResolvedValue({ data: { gxpItValidationDays: -1 } });
    const { result } = renderHook(() => useGetSystemSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.gxpItValidationDays).toBe(30);
  });
});
