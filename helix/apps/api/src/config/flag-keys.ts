export const FlagKeys = {
  AI_PREFILL: 'ai_prefill',  // DPA gate — off until sign-off
} as const;

export type FlagKey = typeof FlagKeys[keyof typeof FlagKeys];
