import { FlagKeys, FlagKey } from '../../src/config/flag-keys';

describe('FlagKeys', () => {
  it('has exactly 1 key', () => {
    expect(Object.keys(FlagKeys)).toHaveLength(1);
  });

  it('AI_PREFILL key is correct', () => {
    expect(FlagKeys.AI_PREFILL).toBe('ai_prefill');
  });

  it('all values are non-empty strings', () => {
    for (const key of Object.keys(FlagKeys) as Array<keyof typeof FlagKeys>) {
      expect(typeof FlagKeys[key]).toBe('string');
      expect(FlagKeys[key].length).toBeGreaterThan(0);
    }
  });

  it('FlagKey type accepts all valid flag values', () => {
    const check = (k: FlagKey) => k;
    expect(check(FlagKeys.AI_PREFILL)).toBe('ai_prefill');
  });
});
