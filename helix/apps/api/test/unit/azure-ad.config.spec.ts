import { getAzureAdConfig } from '../../src/config/azure-ad.config';

describe('getAzureAdConfig()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('development mode', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'development';
    });

    it('returns null when AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID are not set', () => {
      delete process.env['AZURE_AD_TENANT_ID'];
      delete process.env['AZURE_AD_CLIENT_ID'];
      const result = getAzureAdConfig();
      expect(result).toBeNull();
    });

    it('returns config when both vars are set in dev mode', () => {
      process.env['AZURE_AD_TENANT_ID'] = 'dev-tenant';
      process.env['AZURE_AD_CLIENT_ID'] = 'dev-client';
      const result = getAzureAdConfig();
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('dev-tenant');
      expect(result?.clientId).toBe('dev-client');
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
    });

    it('throws when AZURE_AD_TENANT_ID is missing', () => {
      delete process.env['AZURE_AD_TENANT_ID'];
      delete process.env['AZURE_AD_CLIENT_ID'];
      expect(() => getAzureAdConfig()).toThrow('AZURE_AD_TENANT_ID');
    });

    it('throws when AZURE_AD_CLIENT_ID is missing', () => {
      process.env['AZURE_AD_TENANT_ID'] = 'some-tenant';
      delete process.env['AZURE_AD_CLIENT_ID'];
      expect(() => getAzureAdConfig()).toThrow('AZURE_AD_CLIENT_ID');
    });

    it('returns correct config with JWKS URI and issuer when vars are set', () => {
      process.env['AZURE_AD_TENANT_ID'] = 'my-tenant-id';
      process.env['AZURE_AD_CLIENT_ID'] = 'my-client-id';
      const result = getAzureAdConfig();
      expect(result).toEqual({
        tenantId: 'my-tenant-id',
        clientId: 'my-client-id',
        jwksUri: 'https://login.microsoftonline.com/my-tenant-id/discovery/v2.0/keys',
        issuer: 'https://sts.windows.net/my-tenant-id/',
      });
    });
  });
});
