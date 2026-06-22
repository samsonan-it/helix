import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../../src/health/health.controller';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  // ── /health (liveness) ──────────────────────────────────────────────────────

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /api/v1/health returns { status: "ok", db: "ok" } when DB is reachable', async () => {
    const result = await controller.check();
    expect(result).toEqual({ status: 'ok', db: 'ok' });
    expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('throws ServiceUnavailableException when DB is unreachable', async () => {
    prismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));
    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });

  // ── /health/ready (readiness) ───────────────────────────────────────────────

  it('GET /api/v1/health/ready returns 200 with all checks ok (dev mode — AAD skipped)', async () => {
    // $queryRaw called twice: once for DB, once for audit_log table check
    prismaService.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])          // DB check
      .mockResolvedValueOnce([{ count: BigInt(0) }]);        // audit_log check

    const originalTenantId = process.env['AZURE_AD_TENANT_ID'];
    const originalNodeEnv = process.env['NODE_ENV'];
    try {
      delete process.env['AZURE_AD_TENANT_ID'];
      process.env['NODE_ENV'] = 'development';

      const result = await controller.ready();
      expect(result.status).toBe('ok');
      expect(result.db).toBe('ok');
      expect(result.auditLog).toBe('ok');
      expect(result.azureAd).toBe('skipped');
    } finally {
      if (originalTenantId !== undefined) process.env['AZURE_AD_TENANT_ID'] = originalTenantId;
      else delete process.env['AZURE_AD_TENANT_ID'];
      if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
      else delete process.env['NODE_ENV'];
    }
  });

  it('throws ServiceUnavailableException with db failure detail when DB unreachable', async () => {
    prismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));
    const originalNodeEnv = process.env['NODE_ENV'];
    try {
      delete process.env['AZURE_AD_TENANT_ID'];
      process.env['NODE_ENV'] = 'development';
      await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
    } finally {
      if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
      else delete process.env['NODE_ENV'];
    }
  });

  it('throws ServiceUnavailableException when audit_log table unreachable', async () => {
    prismaService.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])          // DB check passes
      .mockRejectedValueOnce(new Error('relation "audit_log" does not exist'));  // audit_log fails
    const originalNodeEnv = process.env['NODE_ENV'];
    try {
      delete process.env['AZURE_AD_TENANT_ID'];
      process.env['NODE_ENV'] = 'development';
      await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
    } finally {
      if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
      else delete process.env['NODE_ENV'];
    }
  });

  // ── /health/ready — Azure AD checks ────────────────────────────────────────

  it('GET /api/v1/health/ready returns azureAd: ok when JWKS fetch succeeds', async () => {
    prismaService.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ '?column?': 1 }]);

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: { cancel: jest.fn().mockResolvedValue(undefined) },
    } as unknown as Response);

    const originalTenantId = process.env['AZURE_AD_TENANT_ID'];
    const originalNodeEnv = process.env['NODE_ENV'];
    try {
      process.env['AZURE_AD_TENANT_ID'] = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      process.env['NODE_ENV'] = 'production';

      const result = await controller.ready();
      expect(result.azureAd).toBe('ok');
    } finally {
      fetchMock.mockRestore();
      if (originalTenantId !== undefined) process.env['AZURE_AD_TENANT_ID'] = originalTenantId;
      else delete process.env['AZURE_AD_TENANT_ID'];
      if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
      else delete process.env['NODE_ENV'];
    }
  });

  it('throws ServiceUnavailableException when JWKS fetch returns non-2xx', async () => {
    prismaService.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ '?column?': 1 }]);

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      body: { cancel: jest.fn().mockResolvedValue(undefined) },
    } as unknown as Response);

    const originalTenantId = process.env['AZURE_AD_TENANT_ID'];
    const originalNodeEnv = process.env['NODE_ENV'];
    try {
      process.env['AZURE_AD_TENANT_ID'] = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      process.env['NODE_ENV'] = 'production';

      await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
    } finally {
      fetchMock.mockRestore();
      if (originalTenantId !== undefined) process.env['AZURE_AD_TENANT_ID'] = originalTenantId;
      else delete process.env['AZURE_AD_TENANT_ID'];
      if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
      else delete process.env['NODE_ENV'];
    }
  });

  it('throws ServiceUnavailableException when AZURE_AD_TENANT_ID is invalid format', async () => {
    prismaService.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ '?column?': 1 }]);

    const originalTenantId = process.env['AZURE_AD_TENANT_ID'];
    const originalNodeEnv = process.env['NODE_ENV'];
    try {
      process.env['AZURE_AD_TENANT_ID'] = 'not-a-valid-guid';
      process.env['NODE_ENV'] = 'production';

      await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
    } finally {
      if (originalTenantId !== undefined) process.env['AZURE_AD_TENANT_ID'] = originalTenantId;
      else delete process.env['AZURE_AD_TENANT_ID'];
      if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
      else delete process.env['NODE_ENV'];
    }
  });
});
