import { ProjectStalenessService, PROJECT_EVENTS, ProjectAssumedCompletedEvent } from '../../src/projects/project-staleness.service';

const makePrisma = () => ({
  project: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      project: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    return fn(tx).then(() => tx);
  }),
});

const makeEventEmitter = () => ({ emit: jest.fn() });

describe('ProjectStalenessService', () => {
  let service: ProjectStalenessService;
  let prisma: ReturnType<typeof makePrisma>;
  let eventEmitter: ReturnType<typeof makeEventEmitter>;

  beforeEach(() => {
    prisma = makePrisma();
    eventEmitter = makeEventEmitter();
    service = new ProjectStalenessService(prisma as never, eventEmitter as never);
  });

  it('queries for IN_EXECUTION projects with past endDate', async () => {
    prisma.project.findMany.mockResolvedValue([]);
    await service.checkAssumedCompleted();
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'IN_EXECUTION' }),
      }),
    );
  });

  it('transitions stale projects to ASSUMED_COMPLETED in a transaction', async () => {
    const stale = [{ id: 'proj-1', assignedPmId: 'user-1', demandId: 'dem-1' }];
    prisma.project.findMany.mockResolvedValue(stale);
    await service.checkAssumedCompleted();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const txFn = prisma.$transaction.mock.calls[0][0];
    const tx = { project: { update: jest.fn() }, auditLog: { create: jest.fn() } };
    await txFn(tx);
    expect(tx.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ASSUMED_COMPLETED' } }),
    );
  });

  it('writes audit log with PROJECT_ASSUMED_COMPLETED event inside transaction', async () => {
    const stale = [{ id: 'proj-1', assignedPmId: 'user-1', demandId: 'dem-1' }];
    prisma.project.findMany.mockResolvedValue(stale);
    await service.checkAssumedCompleted();
    const txFn = prisma.$transaction.mock.calls[0][0];
    const tx = { project: { update: jest.fn() }, auditLog: { create: jest.fn() } };
    await txFn(tx);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'Project',
          eventType: 'PROJECT_ASSUMED_COMPLETED',
          changedBy: 'system',
        }),
      }),
    );
    const auditOrder = tx.auditLog.create.mock.invocationCallOrder[0];
    const updateOrder = tx.project.update.mock.invocationCallOrder[0];
    expect(auditOrder).toBeGreaterThan(updateOrder);
  });

  it('emits project.assumed_completed event after transaction', async () => {
    const stale = [{ id: 'proj-1', assignedPmId: 'user-1', demandId: 'dem-1' }];
    prisma.project.findMany.mockResolvedValue(stale);
    await service.checkAssumedCompleted();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PROJECT_EVENTS.ASSUMED_COMPLETED,
      expect.any(ProjectAssumedCompletedEvent),
    );
  });

  it('does nothing when no stale projects', async () => {
    prisma.project.findMany.mockResolvedValue([]);
    await service.checkAssumedCompleted();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
