import type { ConfidenceLevel } from '@helix/shared';

export type { ConfidenceLevel };

export function confidenceBadgeProps(level: ConfidenceLevel): { color: string; children: string } {
  switch (level) {
    case 'HIGH':   return { color: 'green',  children: 'High' };
    case 'MEDIUM': return { color: 'yellow', children: 'Medium' };
    case 'LOW':    return { color: 'orange', children: 'Low' };
    default: {
      const _exhaustive: never = level;
      return { color: 'gray', children: String(_exhaustive) };
    }
  }
}
