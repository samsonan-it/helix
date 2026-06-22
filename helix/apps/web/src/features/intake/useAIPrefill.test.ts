import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIPrefill } from './useAIPrefill';

vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '../../lib/api';
const mockApi = api as unknown as { post: ReturnType<typeof vi.fn> };

const makeMocks = () => {
  const setValue = vi.fn();
  const getValues = vi.fn().mockReturnValue({});
  return { setValue, getValues };
};

describe('useAIPrefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call API when flag is off', async () => {
    const { setValue, getValues } = makeMocks();
    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: false }, setValue, getValues }),
    );
    await act(() => result.current.triggerPrefill('hello'));
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('auto-applies title when form is empty', async () => {
    const { setValue, getValues } = makeMocks();
    getValues.mockReturnValue({ title: '' });
    mockApi.post.mockResolvedValue({
      data: { title: 'AI Title', confidence: { title: 'HIGH' } },
    });

    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: true }, setValue, getValues }),
    );
    await act(() => result.current.triggerPrefill('describe my project'));

    expect(mockApi.post).toHaveBeenCalledWith('/demands/prefill', { description: 'describe my project' });
    expect(setValue).toHaveBeenCalledWith('title', 'AI Title');
    expect(result.current.aiSuggestedFields.has('title')).toBe(true);
    expect(result.current.aiConfidence).toEqual({ title: 'HIGH' });
  });

  it('does not overwrite non-empty form fields', async () => {
    const { setValue, getValues } = makeMocks();
    getValues.mockReturnValue({ title: 'Existing Title' });
    mockApi.post.mockResolvedValue({
      data: { title: 'AI Title', confidence: {} },
    });

    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: true }, setValue, getValues }),
    );
    await act(() => result.current.triggerPrefill('describe'));
    expect(setValue).not.toHaveBeenCalledWith('title', 'AI Title');
  });

  it('auto-applies costCentreId when in validCostCentreIds and form is empty', async () => {
    const { setValue, getValues } = makeMocks();
    getValues.mockReturnValue({ costCentreId: '' });
    mockApi.post.mockResolvedValue({
      data: { costCentreId: 'cc-1', confidence: {} },
    });

    const { result } = renderHook(() =>
      useAIPrefill({
        flags: { ai_prefill: true },
        setValue,
        getValues,
        validCostCentreIds: new Set(['cc-1']),
      }),
    );
    await act(() => result.current.triggerPrefill('describe'));

    expect(setValue).toHaveBeenCalledWith('costCentreId', 'cc-1');
    expect(result.current.aiSuggestedFields.has('costCentreId')).toBe(true);
  });

  it('does not apply costCentreId when not in validCostCentreIds', async () => {
    const { setValue, getValues } = makeMocks();
    getValues.mockReturnValue({ costCentreId: '' });
    mockApi.post.mockResolvedValue({
      data: { costCentreId: 'unknown-cc', confidence: {} },
    });

    const { result } = renderHook(() =>
      useAIPrefill({
        flags: { ai_prefill: true },
        setValue,
        getValues,
        validCostCentreIds: new Set(['cc-1']),
      }),
    );
    await act(() => result.current.triggerPrefill('describe'));

    expect(setValue).not.toHaveBeenCalledWith('costCentreId', expect.anything());
    expect(result.current.aiSuggestedFields.has('costCentreId')).toBe(false);
  });

  it('auto-applies description, objective, necessity, benefitsObjectives when fields are empty', async () => {
    const { setValue, getValues } = makeMocks();
    getValues.mockReturnValue({ description: '', objective: '', necessity: '', benefitsObjectives: '' });
    mockApi.post.mockResolvedValue({
      data: {
        description: 'A summary',
        objective: 'To achieve X',
        necessity: 'Required by law',
        benefitsObjectives: 'Save costs',
        confidence: {},
      },
    });

    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: true }, setValue, getValues }),
    );
    await act(() => result.current.triggerPrefill('describe'));

    expect(setValue).toHaveBeenCalledWith('description', 'A summary');
    expect(setValue).toHaveBeenCalledWith('objective', 'To achieve X');
    expect(setValue).toHaveBeenCalledWith('necessity', 'Required by law');
    expect(setValue).toHaveBeenCalledWith('benefitsObjectives', 'Save costs');
    expect(result.current.aiSuggestedFields.has('description')).toBe(true);
    expect(result.current.aiSuggestedFields.has('objective')).toBe(true);
    expect(result.current.aiSuggestedFields.has('necessity')).toBe(true);
    expect(result.current.aiSuggestedFields.has('benefitsObjectives')).toBe(true);
  });

  it('exposes estimatedCostCents from API response', async () => {
    const { setValue, getValues } = makeMocks();
    getValues.mockReturnValue({});
    mockApi.post.mockResolvedValue({
      data: { estimatedCostCents: 4_500_000, confidence: {} },
    });

    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: true }, setValue, getValues }),
    );
    await act(() => result.current.triggerPrefill('describe'));

    expect(result.current.estimatedCostCents).toBe(4_500_000);
  });

  it('sets estimatedCostCents to null when absent from API response', async () => {
    const { setValue, getValues } = makeMocks();
    getValues.mockReturnValue({});
    mockApi.post.mockResolvedValue({ data: { title: 'T', confidence: {} } });

    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: true }, setValue, getValues }),
    );
    await act(() => result.current.triggerPrefill('describe'));

    expect(result.current.estimatedCostCents).toBeNull();
  });

  it('markAISuggested adds field to aiSuggestedFields', async () => {
    const { setValue, getValues } = makeMocks();
    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: true }, setValue, getValues }),
    );

    act(() => result.current.markAISuggested('isSmallProject'));
    expect(result.current.aiSuggestedFields.has('isSmallProject')).toBe(true);
  });

  it('sets prefillFailed on API error', async () => {
    const { setValue, getValues } = makeMocks();
    mockApi.post.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: true }, setValue, getValues }),
    );
    await act(() => result.current.triggerPrefill('describe'));

    expect(result.current.prefillFailed).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('clearAISuggested removes field from aiSuggestedFields', async () => {
    const { setValue, getValues } = makeMocks();
    getValues.mockReturnValue({ title: '' });
    mockApi.post.mockResolvedValue({ data: { title: 'AI', confidence: {} } });

    const { result } = renderHook(() =>
      useAIPrefill({ flags: { ai_prefill: true }, setValue, getValues }),
    );
    await act(() => result.current.triggerPrefill('describe'));
    expect(result.current.aiSuggestedFields.has('title')).toBe(true);

    act(() => result.current.clearAISuggested('title'));
    expect(result.current.aiSuggestedFields.has('title')).toBe(false);
  });

  it('return value does not include pendingSuggestions, confirmSuggestion, or dismissSuggestion', () => {
    const { setValue, getValues } = makeMocks();
    const { result } = renderHook(() =>
      useAIPrefill({ flags: {}, setValue, getValues }),
    );
    expect((result.current as unknown as Record<string, unknown>)['pendingSuggestions']).toBeUndefined();
    expect((result.current as unknown as Record<string, unknown>)['confirmSuggestion']).toBeUndefined();
    expect((result.current as unknown as Record<string, unknown>)['dismissSuggestion']).toBeUndefined();
  });
});
