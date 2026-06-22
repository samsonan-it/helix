import { describe, it, expect } from 'vitest';
import { confidenceBadgeProps } from './badgeUtils';

describe('confidenceBadgeProps', () => {
  it('returns green/High for HIGH', () => {
    const props = confidenceBadgeProps('HIGH');
    expect(props.color).toBe('green');
    expect(props.children).toBe('High');
  });

  it('returns yellow/Medium for MEDIUM', () => {
    const props = confidenceBadgeProps('MEDIUM');
    expect(props.color).toBe('yellow');
    expect(props.children).toBe('Medium');
  });

  it('returns orange/Low for LOW', () => {
    const props = confidenceBadgeProps('LOW');
    expect(props.color).toBe('orange');
    expect(props.children).toBe('Low');
  });
});
