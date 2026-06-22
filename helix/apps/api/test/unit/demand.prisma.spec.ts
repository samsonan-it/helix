import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

describe('Demand Prisma model (Story 2.1)', () => {
  let userId: string;
  let demandId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: { email: `test-demand-${Date.now()}@helix.test`, name: 'Test User' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.demand.deleteMany({ where: { originatorId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('creates a demand with DRAFT status and retrieves by originatorId', async () => {
    const demand = await prisma.demand.create({
      data: {
        title: 'Test Demand',
        description: 'A test demand for story 2.1',
        originatorId: userId,
      },
    });
    demandId = demand.id;

    expect(demand.status).toBe('DRAFT');
    expect(demand.title).toBe('Test Demand');
    expect(demand.businessControllerId).toBeNull();
    expect(demand.bcStatus).toBeNull();
    expect(demand.costCentreId).toBeNull();
    expect(demand.startDate).toBeNull();
    expect(demand.endDate).toBeNull();
    expect(demand.draftSavedAt).toBeNull();
  });

  it('finds demands by originatorId', async () => {
    const demands = await prisma.demand.findMany({
      where: { originatorId: userId },
    });
    expect(demands.length).toBeGreaterThanOrEqual(1);
    expect(demands.every((d) => d.originatorId === userId)).toBe(true);
  });

  it('updates draft fields and sets draftSavedAt', async () => {
    const now = new Date();
    const updated = await prisma.demand.update({
      where: { id: demandId },
      data: {
        title: 'Updated Title',
        draftSavedAt: now,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    expect(updated.title).toBe('Updated Title');
    expect(updated.draftSavedAt).toEqual(now);
    expect(updated.startDate).toEqual(new Date('2026-07-01'));
    expect(updated.endDate).toEqual(new Date('2026-12-31'));
  });
});

describe('Demand Prisma model (Story 2.2) — mandatory intake fields', () => {
  let userId: string;
  let legalEntityId: string;
  let areaId: string;
  let dmUserId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const ts = Date.now();
    const user = await prisma.user.create({
      data: { email: `test-2-2-${ts}@helix.test`, name: 'Test User 2.2' },
    });
    userId = user.id;
    const le = await prisma.legalEntity.create({
      data: { code: `LE-${ts}`, name: 'Test LE', country: 'DE' },
    });
    legalEntityId = le.id;
    const area = await prisma.smallProjectArea.create({
      data: { code: `AREA-${ts}`, name: 'Test Area' },
    });
    areaId = area.id;
    const dmUser = await prisma.user.create({
      data: { email: `mgr-${ts}@helix.test`, name: 'Test Manager' },
    });
    dmUserId = dmUser.id;
  });

  afterAll(async () => {
    await prisma.demand.deleteMany({ where: { originatorId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.legalEntity.delete({ where: { id: legalEntityId } });
    await prisma.smallProjectArea.delete({ where: { id: areaId } });
    await prisma.user.delete({ where: { id: dmUserId } });
    await prisma.$disconnect();
  });

  it('creates a demand with all 12 new fields and retrieves them correctly', async () => {
    const demand = await prisma.demand.create({
      data: {
        title: 'Story 2.2 Demand',
        description: 'Testing all new fields',
        originatorId: userId,
        legalEntityId,
        areaId,
        demandManagerId: dmUserId,
        demandOwner: 'Jane Doe',
        objective: 'Deliver X',
        necessity: 'Compliance requirement',
        isMandatory: true,
        qualitativeValueCategory: true,
        quantitativeValueCategory: true,
        asisDescription: 'Current state description',
        benefitsObjectives: 'Expected benefits',
        tobeDescription: 'Future state description',
      },
    });

    expect(demand.legalEntityId).toBe(legalEntityId);
    expect(demand.areaId).toBe(areaId);
    expect(demand.demandManagerId).toBe(dmUserId);
    expect(demand.demandOwner).toBe('Jane Doe');
    expect(demand.objective).toBe('Deliver X');
    expect(demand.necessity).toBe('Compliance requirement');
    expect(demand.isMandatory).toBe(true);
    expect(demand.qualitativeValueCategory).toBe(true);
    expect(demand.quantitativeValueCategory).toBe(true);
    expect(demand.asisDescription).toBe('Current state description');
    expect(demand.benefitsObjectives).toBe('Expected benefits');
    expect(demand.tobeDescription).toBe('Future state description');
  });

  it('defaults isMandatory to false when not provided', async () => {
    const demand = await prisma.demand.create({
      data: {
        title: 'Story 2.2 Default',
        description: 'Checking isMandatory default',
        originatorId: userId,
      },
    });
    expect(demand.isMandatory).toBe(false);
    expect(demand.legalEntityId).toBeNull();
  });
});
