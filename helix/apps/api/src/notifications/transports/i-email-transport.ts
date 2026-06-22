export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export const EMAIL_TRANSPORT_TOKEN = 'EMAIL_TRANSPORT';

export interface IEmailTransport {
  send(message: EmailMessage): Promise<void>;
}
