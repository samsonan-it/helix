/**
 * Typed application configuration — validated at startup.
 * Env vars are loaded by ConfigModule.forRoot({ isGlobal: true }) in AppModule.
 */
export interface AppConfig {
  /** PostgreSQL connection string */
  databaseUrl: string;
  /** Azure Application Insights connection string (empty = disabled) */
  applicationInsightsConnectionString: string;
  /** HTTP server port */
  port: number;
  /** EPAM DIAL AI endpoint — undefined = stub mode (requires Art. 28 DPA gate) */
  dialApiUrl?: string;
  /** EPAM DIAL API key — undefined = stub mode */
  dialApiKey?: string;
  /** DIAL model deployment name */
  dialModelDeployment: string;
  /** DIAL request timeout in ms */
  dialTimeoutMs: number;
}

export function getAppConfig(): AppConfig {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const rawPort = process.env['PORT'] ?? '3000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port)) {
    throw new Error(`PORT environment variable must be a valid number, got: "${rawPort}"`);
  }

  return {
    databaseUrl,
    applicationInsightsConnectionString: process.env['APPLICATIONINSIGHTS_CONNECTION_STRING'] ?? '',
    port,
    dialApiUrl: process.env['DIAL_API_URL'] || undefined,
    dialApiKey: process.env['DIAL_API_KEY'] || undefined,
    dialModelDeployment: process.env['DIAL_MODEL_DEPLOYMENT'] ?? 'gpt-4o',
    dialTimeoutMs: (() => {
      const parsed = parseInt(process.env['DIAL_TIMEOUT_MS'] ?? '3000', 10);
      return isNaN(parsed) || parsed <= 0 ? 3000 : parsed;
    })(),
  };
}
