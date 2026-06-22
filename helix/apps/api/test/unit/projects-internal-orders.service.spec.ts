import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Role } from '@helix/types';
import { ProjectsService } from '../../src/projects/projects.service';

const PROJECT_ID = 'proj-1';
const USER_ID    = 'user-admin';

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: PROJECT_ID,
  opexInternalOrder: null as string | null,
  capexInternalOrder: null as string | null,
  ...overrides,
});

const makeTx = () => ({
  project: {
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
});

const makePrisma = () => {
  const tx = makeTx();
  return {
    project: tx.project,
    auditLog: tx.auditLog,
    $transaction: jest.fn().mockImplementation((cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => cb(tx)),
    _tx: tx,
  };
};

describe('ProjectsService — updateInternalOrders', () => {
  let service: ProjectsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ProjectsService(
      prisma as never,
      { emit: jest.fn() } as never,
      { upload: jest.fn(), delete: jest.fn() } as never,
    );
  });

  it('throws NotFoundException when project does not exist', async () => {
    prisma._tx.project.findUnique.mockResolvedValue(null);
    await expect(
      service.updateInternalOrders(PROJECT_ID, USER_ID, [Role.Admin], { opexInternalOrder: 'IO-001' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates fields and writes audit log with correct before/after', async () => {
    const existing = makeProject({ opexInternalOrder: 'OLD-001', capexInternalOrder: null });
    prisma._tx.project.findUnique.mockResolvedValue(existing);

    await service.updateInternalOrders(PROJECT_ID, USER_ID, [Role.Admin], { opexInternalOrder: 'NEW-001' });

    expect(prisma._tx.project.update).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
      data: { opexInternalOrder: 'NEW-001' },
    });
    expect(prisma._tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Project',
        entityId: PROJECT_ID,
        eventType: 'PROJECT_INTERNAL_ORDER_UPDATED',
        changedBy: USER_ID,
        before: { opexInternalOrder: 'OLD-001', capexInternalOrder: null },
        after: { opexInternalOrder: 'NEW-001', capexInternalOrder: null },
      }),
    });
  });

  it('audit log create is called AFTER project update (Rule 8)', async () => {
    const callOrder: string[] = [];
    prisma._tx.project.findUnique.mockResolvedValue(makeProject());
    prisma._tx.project.update.mockImplementation(() => { callOrder.push('update'); return Promise.resolve({}); });
    prisma._tx.auditLog.create.mockImplementation(() => { callOrder.push('audit'); return Promise.resolve({}); });

    await service.updateInternalOrders(PROJECT_ID, USER_ID, [Role.Admin], { capexInternalOrder: 'CAP-1' });

    expect(callOrder).toEqual(['update', 'audit']);
  });
});

describe('ProjectsService — bulkImportInternalOrders', () => {
  let service: ProjectsService;
  let prisma: ReturnType<typeof makePrisma>;

  const makeFile = (content: string): Express.Multer.File =>
    ({ buffer: Buffer.from(content), originalname: 'orders.csv', mimetype: 'text/csv', size: content.length } as Express.Multer.File);

  beforeEach(() => {
    prisma = makePrisma();
    service = new ProjectsService(
      prisma as never,
      { emit: jest.fn() } as never,
      { upload: jest.fn(), delete: jest.fn() } as never,
    );
  });

  it('returns 422 when a row references a non-existent project', async () => {
    prisma.project.findMany.mockResolvedValue([]);

    const file = makeFile('helix_project_id,opex_internal_order,capex_internal_order\nBAD-ID,,');
    await expect(
      service.bulkImportInternalOrders(file, false, USER_ID, [Role.Admin]),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('returns 422 without overwrite when field already populated', async () => {
    prisma.project.findMany.mockResolvedValue([
      makeProject({ id: 'proj-1', opexInternalOrder: 'EXISTING', capexInternalOrder: null }),
    ]);

    const file = makeFile('helix_project_id,opex_internal_order,capex_internal_order\nproj-1,NEW-ORD,');
    await expect(
      service.bulkImportInternalOrders(file, false, USER_ID, [Role.Admin]),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('commits all rows and audit logs on valid CSV with overwrite=true', async () => {
    prisma.project.findMany.mockResolvedValue([
      makeProject({ id: 'proj-1', opexInternalOrder: 'OLD', capexInternalOrder: null }),
    ]);

    const file = makeFile('helix_project_id,opex_internal_order,capex_internal_order\nproj-1,NEW-ORD,');
    const result = await service.bulkImportInternalOrders(file, true, USER_ID, [Role.Admin]);

    expect(result).toEqual({ imported: 1, skipped: 0, errors: [] });
    expect(prisma._tx.project.update).toHaveBeenCalledTimes(1);
    expect(prisma._tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('commits when fields are empty (no overwrite conflict)', async () => {
    prisma.project.findMany.mockResolvedValue([
      makeProject({ id: 'proj-1', opexInternalOrder: null, capexInternalOrder: null }),
    ]);

    const file = makeFile('helix_project_id,opex_internal_order,capex_internal_order\nproj-1,IO-001,CAP-001');
    const result = await service.bulkImportInternalOrders(file, false, USER_ID, [Role.Admin]);

    expect(result).toEqual({ imported: 1, skipped: 0, errors: [] });
  });
});
