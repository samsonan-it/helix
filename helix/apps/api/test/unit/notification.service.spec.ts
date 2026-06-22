import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../../src/notifications/notification.service';
import { EMAIL_TRANSPORT_TOKEN, IEmailTransport } from '../../src/notifications/transports/i-email-transport';

describe('NotificationService', () => {
  let service: NotificationService;
  let transport: jest.Mocked<IEmailTransport>;

  beforeEach(async () => {
    transport = { send: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'FRONTEND_BASE_URL') return 'https://helix.stada.de';
              throw new Error(`Unknown config key: ${key}`);
            },
            get: jest.fn(),
          },
        },
        { provide: EMAIL_TRANSPORT_TOKEN, useValue: transport },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  describe('buildDeepLink', () => {
    it('returns full URL with view=review', () => {
      expect(service.buildDeepLink('abc123')).toBe(
        'https://helix.stada.de/demands/abc123?view=review',
      );
    });
  });

  describe('buildEmailText', () => {
    it('includes all parts', () => {
      const text = service.buildEmailText('My Demand', 'approved the demand', 'Alice', 'https://link');
      expect(text).toContain('Alice');
      expect(text).toContain('My Demand');
      expect(text).toContain('approved the demand');
      expect(text).toContain('https://link');
    });
  });

  describe('buildEmailHtml', () => {
    it('includes all parts', () => {
      const html = service.buildEmailHtml('My Demand', 'approved the demand', 'Alice', 'https://link');
      expect(html).toContain('Alice');
      expect(html).toContain('My Demand');
      expect(html).toContain('approved the demand');
      expect(html).toContain('https://link');
    });
  });

  describe('sendWithRetry', () => {
    it('sends on first attempt without retries', async () => {
      transport.send.mockResolvedValue(undefined);
      await service.sendWithRetry('d1', { to: ['a@b.com'], subject: 'S', text: 'T', html: '<p>H</p>' });
      expect(transport.send).toHaveBeenCalledTimes(1);
    });

    it('retries up to 3 times on transient failure then logs', async () => {
      jest.useFakeTimers();
      const err = new Error('SMTP timeout');
      transport.send.mockRejectedValue(err);

      const logSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

      const sendPromise = service.sendWithRetry('d1', { to: ['a@b.com'], subject: 'S', text: 'T', html: '<p>H</p>' });

      // advance timers through 1s + 2s + 4s backoff
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);

      await sendPromise;

      expect(transport.send).toHaveBeenCalledTimes(4); // initial + 3 retries
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ demandId: 'd1', error: err }),
        expect.any(String),
      );
      jest.useRealTimers();
    });

    it('succeeds on second attempt', async () => {
      jest.useFakeTimers();
      transport.send
        .mockRejectedValueOnce(new Error('first fail'))
        .mockResolvedValue(undefined);

      const sendPromise = service.sendWithRetry('d2', { to: ['a@b.com'], subject: 'S', text: 'T', html: '<p>H</p>' });
      await jest.advanceTimersByTimeAsync(1000);
      await sendPromise;

      expect(transport.send).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });
});
