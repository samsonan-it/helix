import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../../src/modules/ai/ai.service';
import { PrismaService } from '../../src/prisma/prisma.service';

const setDialEnv = (url = 'https://dial.epam.com', key = 'test-key'): void => {
  process.env['DIAL_API_URL'] = url;
  process.env['DIAL_API_KEY'] = key;
  process.env['DIAL_MODEL_DEPLOYMENT'] = 'gpt-4o';
  process.env['DIAL_TIMEOUT_MS'] = '3000';
};

const clearDialEnv = (): void => {
  delete process.env['DIAL_API_URL'];
  delete process.env['DIAL_API_KEY'];
  delete process.env['DIAL_MODEL_DEPLOYMENT'];
  delete process.env['DIAL_TIMEOUT_MS'];
};

const mockSuccessResponse = (content: object) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
  } as Response);

const mockErrorResponse = (status: number) =>
  Promise.resolve({
    ok: false,
    status,
    json: async () => ({}),
  } as Response);

const prismaMock = {
  costCentre: {
    findFirst: jest.fn(),
  },
};

const buildService = async (): Promise<AiService> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AiService,
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();
  await module.init();
  return module.get<AiService>(AiService);
};

describe('AiService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
    prismaMock.costCentre.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    clearDialEnv();
  });

  // AC-10 — stub mode
  describe('stub mode (no DIAL config)', () => {
    it('returns deterministic stub with new fields and no dead fields', async () => {
      clearDialEnv();
      const svc = await buildService();
      const result = await svc.prefillDemand('Short desc');

      expect(result).toEqual({
        title: 'Short desc',
        costCentreId: null,
        description: null,
        objective: null,
        necessity: null,
        benefitsObjectives: null,
        estimatedCostCents: null,
        confidence: { title: 'LOW' },
      });
      expect(result).not.toHaveProperty('glAccountId');
      expect(result).not.toHaveProperty('estimatedCostRange');
      expect(result).not.toHaveProperty('demandType');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('truncates description > 50 chars in stub mode', async () => {
      clearDialEnv();
      const svc = await buildService();
      const result = await svc.prefillDemand('A'.repeat(55));
      expect(result.title).toBe('A'.repeat(47) + '...');
    });

    it('does not throw when called in stub mode', async () => {
      clearDialEnv();
      const svc = await buildService();
      await expect(svc.prefillDemand('any')).resolves.not.toThrow();
    });
  });

  // AC-2, AC-3 — real DIAL call
  describe('DIAL mode — success', () => {
    it('calls DIAL endpoint and returns new fields in AIPrefillResponse (AC-2, AC-3)', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({
          title: 'Cloud Migration',
          description: 'Migrate on-prem systems to cloud',
          objective: 'Reduce TCO by 30%',
          necessity: 'Current infra is end-of-life',
          benefitsObjectives: 'Cost savings and scalability',
          estimatedCostEuros: 45000,
          costCentreCode: null,
          confidence: {
            title: 'HIGH',
            description: 'HIGH',
            objective: 'MEDIUM',
            necessity: 'MEDIUM',
            benefitsObjectives: 'LOW',
            estimatedCostEuros: 'MEDIUM',
          },
        }),
      );
      const svc = await buildService();
      const result = await svc.prefillDemand('Migrate to cloud');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/openai/deployments/gpt-4o/chat/completions');
      expect((init.headers as Record<string, string>)['Api-Key']).toBe('test-key');

      expect(result.title).toBe('Cloud Migration');
      expect(result.description).toBe('Migrate on-prem systems to cloud');
      expect(result.objective).toBe('Reduce TCO by 30%');
      expect(result.necessity).toBe('Current infra is end-of-life');
      expect(result.benefitsObjectives).toBe('Cost savings and scalability');
      expect(result.estimatedCostCents).toBe(4_500_000);
      expect(result.confidence?.title).toBe('HIGH');
      expect(result.confidence?.description).toBe('HIGH');
      expect(result.confidence?.estimatedCostCents).toBe('MEDIUM');

      expect(result).not.toHaveProperty('glAccountId');
      expect(result).not.toHaveProperty('estimatedCostRange');
      expect(result).not.toHaveProperty('demandType');
    });

    it('converts estimatedCostEuros to estimatedCostCents correctly (AC-3)', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({ title: 'T', estimatedCostEuros: 1234, confidence: { title: 'HIGH' } }),
      );
      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result.estimatedCostCents).toBe(123_400);
    });

    it('returns estimatedCostCents: null when DIAL returns null estimatedCostEuros', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({ title: 'T', estimatedCostEuros: null, confidence: { title: 'HIGH' } }),
      );
      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result.estimatedCostCents).toBeNull();
    });

    it('maps confidence: MEDIUM title', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({ title: 'T', confidence: { title: 'MEDIUM' } }),
      );
      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result.confidence?.title).toBe('MEDIUM');
    });

    it('uses max_tokens 1500 in request body (AC-2)', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({ title: 'T', confidence: { title: 'HIGH' } }),
      );
      const svc = await buildService();
      await svc.prefillDemand('desc');
      const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { max_tokens: number };
      expect(body.max_tokens).toBe(1500);
    });
  });

  // ID resolution — costCentre only
  describe('ID resolution', () => {
    it('resolves costCentreId when code found in DB', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({ title: 'T', costCentreCode: 'CC-100', confidence: { title: 'HIGH' } }),
      );
      prismaMock.costCentre.findFirst.mockResolvedValue({ id: 'cc-uuid-1' });

      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result.costCentreId).toBe('cc-uuid-1');
      expect(prismaMock.costCentre.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('returns null costCentreId when code not found in DB', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({ title: 'T', costCentreCode: 'UNKNOWN', confidence: { title: 'HIGH' } }),
      );
      prismaMock.costCentre.findFirst.mockResolvedValue(null);

      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result.costCentreId).toBeNull();
    });

    it('returns null costCentreId silently when DB lookup throws', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({ title: 'T', costCentreCode: 'CC-100', confidence: { title: 'HIGH' } }),
      );
      prismaMock.costCentre.findFirst.mockRejectedValue(new Error('DB down'));

      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result.costCentreId).toBeNull();
    });
  });

  // Graceful degradation
  describe('graceful degradation', () => {
    it('returns empty confidence on HTTP 500, does not throw', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() => mockErrorResponse(500));
      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result).toEqual({ confidence: {} });
    });

    it('returns empty confidence on HTTP 401, does not throw', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() => mockErrorResponse(401));
      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result).toEqual({ confidence: {} });
    });

    it('returns empty confidence on timeout/network error, does not throw', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
      );
      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result).toEqual({ confidence: {} });
    });

    it('returns empty confidence on unparseable JSON, does not throw', async () => {
      setDialEnv();
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '{{invalid json' } }] }),
        } as Response),
      );
      const svc = await buildService();
      const result = await svc.prefillDemand('desc');
      expect(result).toEqual({ confidence: {} });
    });
  });

  // PII-safe logging
  describe('PII-safe logging', () => {
    it('does not pass description string to logger on failure', async () => {
      setDialEnv();
      const sensitiveDescription = 'SENSITIVE_PII_DATA_12345';
      (global.fetch as jest.Mock).mockImplementation(() => mockErrorResponse(500));

      const svc = await buildService();
      const loggerWarn = jest.spyOn((svc as any).logger, 'warn');

      await svc.prefillDemand(sensitiveDescription);

      loggerWarn.mock.calls.forEach((args) => {
        const logLine = args.join(' ');
        expect(logLine).not.toContain(sensitiveDescription);
      });
    });

    it('does not pass description string to logger on success', async () => {
      setDialEnv();
      const sensitiveDescription = 'SENSITIVE_PII_DATA_12345';
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockSuccessResponse({ title: 'T', confidence: { title: 'HIGH' } }),
      );

      const svc = await buildService();
      const loggerLog = jest.spyOn((svc as any).logger, 'log');
      const loggerWarn = jest.spyOn((svc as any).logger, 'warn');

      await svc.prefillDemand(sensitiveDescription);

      [...loggerLog.mock.calls, ...loggerWarn.mock.calls].forEach((args) => {
        const logLine = args.join(' ');
        expect(logLine).not.toContain(sensitiveDescription);
      });
    });
  });
});
