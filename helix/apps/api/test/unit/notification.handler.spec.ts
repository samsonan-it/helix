import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { NotificationHandler } from '../../src/notifications/notification.handler';
import { NotificationService } from '../../src/notifications/notification.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  DemandSubmittedEvent,
  DemandSpDmAcceptedEvent,
  DemandDmReroutedEvent,
  DemandDmRejectedEvent,
  DemandSpOfferSentEvent,
  DemandSpOfferAcceptedEvent,
  DemandSpOfferReworkedEvent,
  DemandPmApprovedEvent,
  DemandBcReviewStartedEvent,
  DemandBcApprovedEvent,
  DemandBcRejectedEvent,
  DemandBcReroutedToRequesterEvent,
  DemandPmSentToRequesterEvent,
  DemandPmSentToDmEvent,
} from '../../src/notifications/events/demand.events';

const mockDemand = {
  title: 'Test Demand',
  publicId: 42,
  businessControllerId: 'bc1',
  originator: { email: 'originator@test.com', name: 'Alice' },
  demandManager: { email: 'dm@test.com', name: 'Bob' },
};

const noDmDemand = { ...mockDemand, demandManager: null };
const noBcDemand = { ...mockDemand, businessControllerId: null };

describe('NotificationHandler', () => {
  let handler: NotificationHandler;
  let notificationService: jest.Mocked<Pick<NotificationService, 'buildDeepLink' | 'buildEmailText' | 'buildEmailHtml' | 'sendWithRetry'>>;
  let prisma: jest.Mocked<Pick<PrismaService, 'demand' | 'userRoleAssignment' | 'user'>>;

  beforeEach(async () => {
    notificationService = {
      buildDeepLink: jest.fn().mockReturnValue('https://helix.stada.de/demands/d1?view=review'),
      buildEmailText: jest.fn().mockReturnValue('text'),
      buildEmailHtml: jest.fn().mockReturnValue('<p>html</p>'),
      sendWithRetry: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      demand: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockDemand),
      } as any,
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([
          { user: { email: 'pm1@test.com' } },
          { user: { email: 'pm2@test.com' } },
        ]),
      } as any,
      user: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === 'bc1') return Promise.resolve({ email: 'bc@test.com', name: 'BC User' });
          return Promise.resolve({ email: 'actor@test.com', name: 'Actor User' });
        }),
      } as any,
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationHandler,
        { provide: NotificationService, useValue: notificationService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(NotificationHandler);
  });

  it('onSubmitted — sends to DM', async () => {
    await handler.onSubmitted(new DemandSubmittedEvent('d1', 'orig1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['dm@test.com'],
    }));
  });

  it('onSubmitted — skips when no DM assigned', async () => {
    (prisma.demand.findUniqueOrThrow as jest.Mock).mockResolvedValue(noDmDemand);
    await handler.onSubmitted(new DemandSubmittedEvent('d1', 'orig1'));
    expect(notificationService.sendWithRetry).not.toHaveBeenCalled();
  });

  // onAccepted tests removed — handler removed in code review (Story 4.11 changed P-path;
  // PM notifications for BC-approved demands will be added in Story 4.16).

  it('onSpDmAccepted — sends to originator', async () => {
    await handler.onSpDmAccepted(new DemandSpDmAcceptedEvent('d1', 'dm1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com'],
    }));
  });

  it('onDmRerouted — sends to originator', async () => {
    await handler.onDmRerouted(new DemandDmReroutedEvent('d1', 'dm1', 'needs work'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com'],
    }));
  });

  it('onDmRejected — sends to originator', async () => {
    await handler.onDmRejected(new DemandDmRejectedEvent('d1', 'dm1', 'rejected'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com'],
    }));
  });

  it('onSpOfferSent — sends to originator', async () => {
    await handler.onSpOfferSent(new DemandSpOfferSentEvent('d1', 'dm1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com'],
    }));
  });

  it('onSpOfferAccepted — sends to all PMs', async () => {
    await handler.onSpOfferAccepted(new DemandSpOfferAcceptedEvent('d1', 'orig1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['pm1@test.com', 'pm2@test.com'],
    }));
  });

  it('onSpOfferReworked — sends to DM', async () => {
    await handler.onSpOfferReworked(new DemandSpOfferReworkedEvent('d1', 'orig1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['dm@test.com'],
    }));
  });

  it('onSpOfferReworked — skips when no DM', async () => {
    (prisma.demand.findUniqueOrThrow as jest.Mock).mockResolvedValue(noDmDemand);
    await handler.onSpOfferReworked(new DemandSpOfferReworkedEvent('d1', 'orig1'));
    expect(notificationService.sendWithRetry).not.toHaveBeenCalled();
  });

  // Story 4.16 — BC notification handlers

  it('onBcReviewStarted — sends to BC', async () => {
    await handler.onBcReviewStarted(new DemandBcReviewStartedEvent('d1', 'dm1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['bc@test.com'],
      subject: `New demand awaiting your review: ${mockDemand.title} (#${mockDemand.publicId})`,
    }));
  });

  it('onBcReviewStarted — skips when no BC assigned', async () => {
    (prisma.demand.findUniqueOrThrow as jest.Mock).mockResolvedValue(noBcDemand);
    await handler.onBcReviewStarted(new DemandBcReviewStartedEvent('d1', 'dm1'));
    expect(notificationService.sendWithRetry).not.toHaveBeenCalled();
  });

  it('onBcApproved — sends to all PMs', async () => {
    await handler.onBcApproved(new DemandBcApprovedEvent('d1', 'bc1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['pm1@test.com', 'pm2@test.com'],
      subject: `Demand awaiting your approval: ${mockDemand.title} (#${mockDemand.publicId})`,
    }));
  });

  it('onBcApproved — uses BC name as actor', async () => {
    await handler.onBcApproved(new DemandBcApprovedEvent('d1', 'bc1'));
    expect(notificationService.buildEmailText).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'BC User', expect.anything(),
    );
  });

  it('onBcApproved — skips when no PMs exist', async () => {
    (prisma.userRoleAssignment.findMany as jest.Mock).mockResolvedValue([]);
    await handler.onBcApproved(new DemandBcApprovedEvent('d1', 'bc1'));
    expect(notificationService.sendWithRetry).not.toHaveBeenCalled();
  });

  it('onBcRejected — sends to originator and DM', async () => {
    await handler.onBcRejected(new DemandBcRejectedEvent('d1', 'bc1', 'Not approved'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com', 'dm@test.com'],
      subject: `Demand rejected: ${mockDemand.title} (#${mockDemand.publicId})`,
    }));
  });

  it('onBcRejected — includes commentary in email body', async () => {
    await handler.onBcRejected(new DemandBcRejectedEvent('d1', 'bc1', 'Budget exceeded'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      text: 'text\n\nReason: Budget exceeded',
      html: '<p>html</p>\n<p><strong>Reason:</strong> Budget exceeded</p>',
    }));
  });

  it('onBcRejected — sends to originator only when no DM', async () => {
    (prisma.demand.findUniqueOrThrow as jest.Mock).mockResolvedValue(noDmDemand);
    await handler.onBcRejected(new DemandBcRejectedEvent('d1', 'bc1', 'Not approved'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com'],
    }));
  });

  it('onBcReroutedToRequester — sends to originator', async () => {
    await handler.onBcReroutedToRequester(new DemandBcReroutedToRequesterEvent('d1', 'bc1', 'Please revise'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com'],
      subject: `Your demand requires rework: ${mockDemand.title} (#${mockDemand.publicId})`,
    }));
  });

  it('onBcReroutedToRequester — includes BC comment in email body', async () => {
    await handler.onBcReroutedToRequester(new DemandBcReroutedToRequesterEvent('d1', 'bc1', 'Needs clarification'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      text: 'text\n\nReason: Needs clarification',
      html: '<p>html</p>\n<p><strong>Reason:</strong> Needs clarification</p>',
    }));
  });

  it('onPmSentToRequester — sends to originator with commentary', async () => {
    await handler.onPmSentToRequester(new DemandPmSentToRequesterEvent('d1', 'pm1', 'Please clarify budget'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com'],
      subject: `Your demand requires revision: ${mockDemand.title} (#${mockDemand.publicId})`,
      text: 'text\n\nReason: Please clarify budget',
    }));
  });

  it('onPmSentToDm — sends to DM with commentary', async () => {
    await handler.onPmSentToDm(new DemandPmSentToDmEvent('d1', 'pm1', 'Needs DM input'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['dm@test.com'],
      subject: `A demand has been returned to you: ${mockDemand.title} (#${mockDemand.publicId})`,
      text: 'text\n\nReason: Needs DM input',
    }));
  });

  it('onPmSentToDm — skips when no DM', async () => {
    (prisma.demand.findUniqueOrThrow as jest.Mock).mockResolvedValue(noDmDemand);
    await handler.onPmSentToDm(new DemandPmSentToDmEvent('d1', 'pm1', 'Needs DM input'));
    expect(notificationService.sendWithRetry).not.toHaveBeenCalled();
  });

  it('onPmApproved — sends to originator, DM, and BC', async () => {
    await handler.onPmApproved(new DemandPmApprovedEvent('d1', 'pm1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com', 'dm@test.com', 'bc@test.com'],
    }));
  });

  it('onPmApproved — sends to originator and DM only when no BC', async () => {
    (prisma.demand.findUniqueOrThrow as jest.Mock).mockResolvedValue(noBcDemand);
    await handler.onPmApproved(new DemandPmApprovedEvent('d1', 'pm1'));
    expect(notificationService.sendWithRetry).toHaveBeenCalledWith('d1', expect.objectContaining({
      to: ['originator@test.com', 'dm@test.com'],
    }));
  });
});
