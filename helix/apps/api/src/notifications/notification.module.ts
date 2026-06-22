import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationHandler } from './notification.handler';
import { NotificationService } from './notification.service';
import { SmtpTransport } from './transports/smtp.transport';
import { AzureCommServicesTransport } from './transports/acs.transport';
import { EMAIL_TRANSPORT_TOKEN } from './transports/i-email-transport';

const nullTransport = { send: async () => undefined };

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    NotificationHandler,
    NotificationService,
    {
      provide: EMAIL_TRANSPORT_TOKEN,
      useFactory: (config: ConfigService) => {
        const transport = config.get<string>('EMAIL_TRANSPORT', '');
        if (!transport) {
          new Logger('NotificationModule').warn('EMAIL_TRANSPORT not set — email notifications disabled');
          return nullTransport;
        }
        if (transport === 'acs') return new AzureCommServicesTransport(config);
        if (transport === 'smtp') return new SmtpTransport(config);
        throw new Error(`Unknown EMAIL_TRANSPORT value: "${transport}". Expected "smtp" or "acs".`);
      },
      inject: [ConfigService],
    },
  ],
})
export class NotificationModule {}
