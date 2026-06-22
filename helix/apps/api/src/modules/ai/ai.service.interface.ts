import { AIPrefillResponse } from '@helix/shared';

export interface IAIService {
  prefillDemand(description: string): Promise<AIPrefillResponse>;
}
