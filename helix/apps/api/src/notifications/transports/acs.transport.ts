import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailClient } from '@azure/communication-email';
import type { IEmailTransport, EmailMessage } from './i-email-transport';

@Injectable()
export class AzureCommServicesTransport implements IEmailTransport {
  private client: EmailClient;
  private sender: string;

  constructor(config: ConfigService) {
    this.client = new EmailClient(config.getOrThrow<string>('ACS_CONNECTION_STRING'));
    this.sender = config.getOrThrow<string>('ACS_SENDER_ADDRESS');
  }

  async send(message: EmailMessage): Promise<void> {
    const poller = await this.client.beginSend({
      senderAddress: this.sender,
      recipients: { to: message.to.map((address) => ({ address })) },
      content: { subject: message.subject, plainText: message.text, html: message.html },
    });
    await poller.pollUntilDone({ abortSignal: AbortSignal.timeout(30_000) });
  }
}
