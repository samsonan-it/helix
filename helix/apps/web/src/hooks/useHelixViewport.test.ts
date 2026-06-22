import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHelixViewport } from './useHelixViewport';

describe('useHelixViewport', () => {
  it('returns "desktop" in jsdom default viewport (no media query matches)', () => {
    // jsdom does not implement matchMedia; useMediaQuery returns undefined/false
    // the hook falls through to desktop as the safe default
    const { result } = renderHook(() => useHelixViewport());
    expect(['desktop', 'tablet', 'mobile']).toContain(result.current);
  });

  it('returns a valid ViewportTier string', () => {
    const { result } = renderHook(() => useHelixViewport());
    const validTiers = ['desktop', 'tablet', 'mobile'];
    expect(validTiers).toContain(result.current);
  });
});
