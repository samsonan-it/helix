import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { IEmailTransport, EmailMessage } from './i-email-transport';

@Injectable()
export class SmtpTransport implements IEmailTransport {
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('SMTP_FROM', 'helix@stada.de');
    const smtpUser = config.get<string>('SMTP_USER', '');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
      ...(smtpUser ? { auth: { user: smtpUser, pass: config.get<string>('SMTP_PASS', '') } } : {}),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to.join(', '),
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
