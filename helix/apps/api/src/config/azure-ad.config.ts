export interface AzureAdConfig {
  tenantId: string;
  clientId: string;
  jwksUri: string;
  issuer: string;
}

export function getAzureAdConfig(): AzureAdConfig | null {
  const tenantId = process.env['AZURE_AD_TENANT_ID'];
  const clientId = process.env['AZURE_AD_CLIENT_ID'];
  const isDev = process.env['NODE_ENV'] === 'development';

  if (!tenantId || !clientId) {
    if (!isDev) {
      throw new Error(
        'AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID are required in non-development environments',
      );
    }
    return null;
  }
  return {
    tenantId,
    clientId,
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    issuer: `https://sts.windows.net/${tenantId}/`,
  };
}
