import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

interface HealthResult {
  status: string;
  db: string;
}

interface ReadyResult {
  status: string;
  db: string;
  auditLog: string;
  azureAd: 'ok' | 'skipped';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  @ApiOperation({ summary: 'Liveness probe — verifies API is running' })
  @Get()
  async check(): Promise<HealthResult> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }
  }

  @ApiOperation({ summary: 'Readiness probe — verifies all dependencies are reachable' })
  @Get('ready')
  async ready(): Promise<ReadyResult> {
    // Check 1: database connectivity
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Dependency unreachable: database');
    }

    // Check 2: audit_log table accessible
    try {
      await this.prismaService.$queryRaw`SELECT 1 FROM audit_log LIMIT 1`;
    } catch {
      throw new ServiceUnavailableException('Dependency unreachable: audit_log');
    }

    // Check 3: Azure AD JWKS endpoint (skipped in dev mode only)
    const azureAd = await this.checkAzureAd();

    return { status: 'ok', db: 'ok', auditLog: 'ok', azureAd };
  }

  private async checkAzureAd(): Promise<'ok' | 'skipped'> {
    const tenantId = process.env['AZURE_AD_TENANT_ID'];
    const isDev = process.env['NODE_ENV'] === 'development';
    if (isDev && !tenantId) return 'skipped';
    if (!tenantId) throw new ServiceUnavailableException('Dependency unreachable: azure_ad_config');

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(tenantId)) {
      throw new ServiceUnavailableException('Dependency unreachable: azure_ad_config');
    }

    const url = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        await res.body?.cancel();
        if (!res.ok) throw new Error(`AAD JWKS returned ${res.status}`);
        return 'ok';
      } catch {
        if (attempt === 2) {
          throw new ServiceUnavailableException('Dependency unreachable: azure_ad');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ServiceUnavailableException('Dependency unreachable: azure_ad');
  }
}
