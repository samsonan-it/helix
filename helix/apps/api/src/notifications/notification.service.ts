import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_TRANSPORT_TOKEN, IEmailTransport, EmailMessage } from './transports/i-email-transport';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly frontendBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(EMAIL_TRANSPORT_TOKEN) private readonly transport: IEmailTransport,
  ) {
    this.frontendBaseUrl = this.config.getOrThrow<string>('FRONTEND_BASE_URL');
  }

  buildDeepLink(demandId: string): string {
    return `${this.frontendBaseUrl}/demands/${demandId}?view=review`;
  }

  buildProjectDeepLink(projectId: string): string {
    return `${this.frontendBaseUrl}/projects?id=${projectId}`;
  }

  buildStatusReportDeepLink(projectId: string): string {
    return `${this.frontendBaseUrl}/projects/${projectId}/status-report`;
  }

  async sendWithRetry(demandId: string, message: EmailMessage): Promise<void> {
    const delays = [1000, 2000, 4000];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        await this.transport.send(message);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
    }

    this.logger.error(
      { demandId, error: lastError },
      'Notification delivery failed after all retries',
    );
  }

  buildEmailHtml(demandTitle: string, action: string, actorName: string, deepLink: string): string {
    return `<p>${actorName} has taken the following action on <strong>${demandTitle}</strong>: ${action}.</p>\n<p><a href="${deepLink}">Open demand record →</a></p>`;
  }

  buildEmailText(demandTitle: string, action: string, actorName: string, deepLink: string): string {
    return `${actorName} has taken the following action on "${demandTitle}": ${action}.\n\nOpen demand record: ${deepLink}`;
  }
}
