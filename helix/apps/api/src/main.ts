import * as appInsights from 'applicationinsights';
appInsights.setup(process.env['APPLICATIONINSIGHTS_CONNECTION_STRING'] ?? '').start();
// Only now can NestJS imports and NestFactory appear
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({ origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:8080', credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());

  if (!process.env['AZURE_AD_CLIENT_SECRET']) {
    logger.warn('in-memory session store active — sessions will not survive process restart');
  }

  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Helix API')
      .setVersion('v1')
      .addCookieAuth('helix-session')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(3000);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
