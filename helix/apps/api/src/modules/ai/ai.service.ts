import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AIPrefillResponse } from '@helix/shared';
import { IAIService } from './ai.service.interface';
import { getAppConfig } from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';

const SYSTEM_PROMPT = `You are an IT demand classification assistant for a pharmaceutical company.
Extract structured fields from the user's free-text demand description.
Return ONLY a JSON object matching this schema (all fields optional):
{
  "title": string (max 80 chars, concise project title),
  "description": string | null (brief demand summary, max 300 chars, null if not extractable),
  "objective": string | null (what the project aims to achieve, null if not mentioned),
  "necessity": string | null (why this project is necessary or urgent, null if not mentioned),
  "benefitsObjectives": string | null (expected business benefits or value, null if not mentioned),
  "estimatedCostEuros": number | null (integer total estimated project cost in euros, e.g. 45000 for €45K; null if not mentioned or unclear),
  "costCentreCode": string | null (extract cost centre code or name hint if mentioned, null otherwise),
  "confidence": {
    "title": "HIGH" | "MEDIUM" | "LOW",
    "description": "HIGH" | "MEDIUM" | "LOW" | null,
    "objective": "HIGH" | "MEDIUM" | "LOW" | null,
    "necessity": "HIGH" | "MEDIUM" | "LOW" | null,
    "benefitsObjectives": "HIGH" | "MEDIUM" | "LOW" | null,
    "estimatedCostEuros": "HIGH" | "MEDIUM" | "LOW" | null
  }
}
Confidence rules:
- HIGH: explicit clear value in the text
- MEDIUM: inferred with reasonable confidence
- LOW: guessed or very uncertain
- null: field could not be extracted at all`;

interface RawDialExtraction {
  title?: string;
  description?: string | null;
  objective?: string | null;
  necessity?: string | null;
  benefitsObjectives?: string | null;
  estimatedCostEuros?: number | null;
  costCentreCode?: string | null;
  confidence?: {
    title?: 'HIGH' | 'MEDIUM' | 'LOW';
    description?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    objective?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    necessity?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    benefitsObjectives?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    estimatedCostEuros?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  };
}

@Injectable()
export class AiService implements IAIService, OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly dialApiUrl: string | undefined;
  private readonly dialApiKey: string | undefined;
  private readonly dialModelDeployment: string;
  private readonly dialTimeoutMs: number;

  constructor(private readonly prisma: PrismaService) {
    const config = getAppConfig();
    this.dialApiUrl = config.dialApiUrl;
    this.dialApiKey = config.dialApiKey;
    this.dialModelDeployment = config.dialModelDeployment;
    this.dialTimeoutMs = config.dialTimeoutMs;
  }

  onModuleInit(): void {
    if (!this.dialApiUrl || !this.dialApiKey) {
      this.logger.warn(
        'DIAL_API_URL / DIAL_API_KEY not configured — AiService running in stub mode',
      );
      return;
    }

    this.logger.log(`AiService running in DIAL mode (deployment: ${this.dialModelDeployment})`);

    const isEuDomain = /epam\.com|azure\.com|eu\./i.test(this.dialApiUrl);
    if (!isEuDomain) {
      this.logger.warn(
        `DIAL_API_URL "${this.dialApiUrl}" does not appear to be an EU-hosted endpoint. ` +
          'Verify NFR6 compliance (no cross-border AI calls) before enabling ai_prefill in production.',
      );
    }
  }

  async prefillDemand(description: string): Promise<AIPrefillResponse> {
    if (!this.dialApiUrl || !this.dialApiKey) {
      return this.stub(description);
    }

    try {
      const raw = await this.callDial(description);
      const resolvedIds = await this.resolveIds(raw.costCentreCode ?? null);
      return this.mapToResponse(raw, resolvedIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`DIAL prefill failed: ${message}`);
      return { confidence: {} };
    }
  }

  private async callDial(description: string): Promise<RawDialExtraction> {
    const url = `${this.dialApiUrl}/openai/deployments/${this.dialModelDeployment}/chat/completions`;
    const start = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.dialApiKey!,
        },
        body: JSON.stringify({
          model: this.dialModelDeployment,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: description },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(this.dialTimeoutMs),
      });
    } catch (err) {
      const elapsed = Date.now() - start;
      this.logger.warn(`DIAL call failed: timeout or network error, elapsed ${elapsed}ms`);
      throw err;
    }

    this.logger.log(`DIAL response: ${response}`)

    const elapsed = Date.now() - start;

    if (!response.ok) {
      this.logger.warn(`DIAL call failed: HTTP ${response.status}, elapsed ${elapsed}ms`);
      throw new Error(`DIAL HTTP ${response.status}`);
    }

    this.logger.log(`DIAL call succeeded, elapsed ${elapsed}ms`);

    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content: string | undefined = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('DIAL response missing choices[0].message.content');
    }

    return JSON.parse(content) as RawDialExtraction;

  }

  private async resolveIds(
    costCentreCode: string | null,
  ): Promise<{ costCentreId: string | null }> {
    try {
      const costCentre = costCentreCode
        ? await this.prisma.costCentre.findFirst({
            where: { code: { equals: costCentreCode, mode: 'insensitive' }, isActive: true },
            select: { id: true },
          })
        : null;
      return { costCentreId: costCentre?.id ?? null };
    } catch {
      this.logger.warn('ID resolution DB lookup failed — returning null IDs');
      return { costCentreId: null };
    }
  }

  private mapToResponse(
    raw: RawDialExtraction,
    resolvedIds: { costCentreId: string | null },
  ): AIPrefillResponse {
    return {
      title: raw.title ?? null,
      costCentreId: resolvedIds.costCentreId,
      description: raw.description ?? null,
      objective: raw.objective ?? null,
      necessity: raw.necessity ?? null,
      benefitsObjectives: raw.benefitsObjectives ?? null,
      estimatedCostCents: raw.estimatedCostEuros != null
        ? Math.round(raw.estimatedCostEuros * 100)
        : null,
      confidence: {
        title: raw.confidence?.title ?? undefined,
        description: raw.confidence?.description ?? undefined,
        objective: raw.confidence?.objective ?? undefined,
        necessity: raw.confidence?.necessity ?? undefined,
        benefitsObjectives: raw.confidence?.benefitsObjectives ?? undefined,
        estimatedCostCents: raw.confidence?.estimatedCostEuros ?? undefined,
      },
    };
  }

  private stub(description: string): AIPrefillResponse {
    return {
      title: description.length > 50 ? description.slice(0, 47) + '...' : description,
      costCentreId: null,
      description: null,
      objective: null,
      necessity: null,
      benefitsObjectives: null,
      estimatedCostCents: null,
      confidence: { title: 'LOW' },
    };
  }
}
