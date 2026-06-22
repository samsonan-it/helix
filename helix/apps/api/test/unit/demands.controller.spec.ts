import 'reflect-metadata';
import { SessionAuthGuard } from '../../src/common/guards/session-auth.guard';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DemandsController } from '../../src/demands/demands.controller';
import { DemandsService } from '../../src/demands/demands.service';
import { FlagService } from '../../src/config/flag.service';
import { AiService } from '../../src/modules/ai/ai.service';
import { FlagKeys } from '../../src/config/flag-keys';
import { Role } from '@helix/types';
import { AIPrefillResponse } from '@helix/shared';

const mockUser = { id: 'user-1', email: 'user@test.com', roles: [Role.DemandRequester] };
const mockDmUser = { id: 'dm-1', email: 'dm@test.com', roles: [Role.DemandManager] };

describe('DemandsController — prefillDemand', () => {
  let controller: DemandsController;
  let flagService: { get: jest.Mock };
  let aiService: { prefillDemand: jest.Mock };

  beforeEach(async () => {
    flagService = { get: jest.fn() };
    aiService = { prefillDemand: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DemandsController],
      providers: [
        { provide: DemandsService, useValue: {} },
        { provide: FlagService, useValue: flagService },
        { provide: AiService, useValue: aiService },
      ],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<DemandsController>(DemandsController);
  });

  it('throws NotFoundException when AI_PREFILL flag is false', async () => {
    flagService.get.mockResolvedValue(false);
    await expect(
      controller.prefillDemand({ description: 'test' }, mockUser as never),
    ).rejects.toThrow(NotFoundException);
    expect(aiService.prefillDemand).not.toHaveBeenCalled();
  });

  it('calls AiService and returns response when flag is true', async () => {
    flagService.get.mockResolvedValue(true);
    const mockResponse: AIPrefillResponse = {
      title: 'test',
      confidence: { title: 'LOW' },
    };
    aiService.prefillDemand.mockResolvedValue(mockResponse);

    const result = await controller.prefillDemand({ description: 'test description' }, mockUser as never);

    expect(flagService.get).toHaveBeenCalledWith(FlagKeys.AI_PREFILL);
    expect(aiService.prefillDemand).toHaveBeenCalledWith('test description');
    expect(result).toEqual(mockResponse);
  });

  it('throws when AI service times out', async () => {
    flagService.get.mockResolvedValue(true);
    // Simulate slow AI service — the 3-second timeout rejects the race
    aiService.prefillDemand.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ title: 'slow', confidence: {} }), 5000)),
    );

    await expect(
      controller.prefillDemand({ description: 'slow test' }, mockUser as never),
    ).rejects.toThrow('AI service timeout');
  }, 10_000);
});

describe('DemandsController — DM queue and action routes (Story 4.1)', () => {
  let controller: DemandsController;
  let demandsService: {
    getDmQueue: jest.Mock;
    dmAccept: jest.Mock;
    dmReturn: jest.Mock;
    dmReject: jest.Mock;
    dmPostpone: jest.Mock;
    dmResume: jest.Mock;
  };

  beforeEach(async () => {
    demandsService = {
      getDmQueue: jest.fn().mockResolvedValue([]),
      dmAccept: jest.fn().mockResolvedValue({}),
      dmReturn: jest.fn().mockResolvedValue({}),
      dmReject: jest.fn().mockResolvedValue({}),
      dmPostpone: jest.fn().mockResolvedValue({}),
      dmResume: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DemandsController],
      providers: [
        { provide: DemandsService, useValue: demandsService },
        { provide: FlagService, useValue: { get: jest.fn() } },
        { provide: AiService, useValue: { prefillDemand: jest.fn() } },
      ],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<DemandsController>(DemandsController);
  });

  it('getDmQueue() delegates to demandsService.getDmQueue with parsed filters', async () => {
    await controller.getDmQueue(mockDmUser as never, 'SUBMITTED', 'invoice', 'false');
    expect(demandsService.getDmQueue).toHaveBeenCalledWith('dm-1', { status: 'SUBMITTED', search: 'invoice', stalledOnly: false });
  });

  it('getDmQueue() passes stalledOnly=true when query param is "true"', async () => {
    await controller.getDmQueue(mockDmUser as never, undefined, undefined, 'true');
    expect(demandsService.getDmQueue).toHaveBeenCalledWith('dm-1', { status: undefined, search: undefined, stalledOnly: true });
  });

  it('getDmQueue() has @Roles(DemandManager) metadata', () => {
    const reflector = new Reflector();
    const roles = reflector.get<Role[]>('roles', controller.getDmQueue);
    expect(roles).toContain(Role.DemandManager);
  });

  it('dmAccept() delegates to demandsService.dmAccept', async () => {
    const dto = { fundingType: 'Business' as const };
    await controller.dmAccept('d-1', dto, mockDmUser as never);
    expect(demandsService.dmAccept).toHaveBeenCalledWith('d-1', 'dm-1', dto);
  });

  it('dmReturn() delegates to demandsService.dmReturn', async () => {
    const dto = { fundingType: 'Business' as const, dmCommentary: 'needs work' };
    await controller.dmReturn('d-1', dto, mockDmUser as never);
    expect(demandsService.dmReturn).toHaveBeenCalledWith('d-1', 'dm-1', dto);
  });

  it('dmReject() delegates to demandsService.dmReject', async () => {
    const dto = { fundingType: 'IT' as const, dmCommentary: 'rejected' };
    await controller.dmReject('d-1', dto, mockDmUser as never);
    expect(demandsService.dmReject).toHaveBeenCalledWith('d-1', 'dm-1', dto);
  });

  it('dmPostpone() delegates to demandsService.dmPostpone', async () => {
    await controller.dmPostpone('d-1', { onHoldReason: 'budget' }, mockDmUser as never);
    expect(demandsService.dmPostpone).toHaveBeenCalledWith('d-1', 'dm-1', { onHoldReason: 'budget' });
  });

  it('dmResume() delegates to demandsService.dmResume', async () => {
    await controller.dmResume('d-1', mockDmUser as never);
    expect(demandsService.dmResume).toHaveBeenCalledWith('d-1', 'dm-1');
  });

  it('action routes have @Roles(DemandManager) metadata', () => {
    const reflector = new Reflector();
    const acceptRoles = reflector.get<Role[]>('roles', controller.dmAccept);
    const returnRoles = reflector.get<Role[]>('roles', controller.dmReturn);
    const rejectRoles = reflector.get<Role[]>('roles', controller.dmReject);
    const postponeRoles = reflector.get<Role[]>('roles', controller.dmPostpone);
    const resumeRoles = reflector.get<Role[]>('roles', controller.dmResume);
    for (const roles of [acceptRoles, returnRoles, rejectRoles, postponeRoles, resumeRoles]) {
      expect(roles).toContain(Role.DemandManager);
    }
  });
});

const mockPmUser = { id: 'pm-1', email: 'pm@test.com', roles: [Role.PortfolioManager] };

describe('DemandsController — PM queue and action routes (Story 4.2)', () => {
  let controller: DemandsController;
  let demandsService: {
    getPmQueue: jest.Mock;
    getDemandHistory: jest.Mock;
    pmApprove: jest.Mock;
    pmReject: jest.Mock;
  };

  beforeEach(async () => {
    demandsService = {
      getPmQueue: jest.fn().mockResolvedValue([]),
      getDemandHistory: jest.fn().mockResolvedValue([]),
      pmApprove: jest.fn().mockResolvedValue({}),
      pmReject: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DemandsController],
      providers: [
        { provide: DemandsService, useValue: demandsService },
        { provide: FlagService, useValue: { get: jest.fn() } },
        { provide: AiService, useValue: { prefillDemand: jest.fn() } },
      ],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<DemandsController>(DemandsController);
  });

  it('getPmQueue() delegates to demandsService.getPmQueue with parsed filters', async () => {
    await controller.getPmQueue(mockPmUser as never, 'IN_REVIEW', 'budget', 'false');
    expect(demandsService.getPmQueue).toHaveBeenCalledWith('pm-1', { status: 'IN_REVIEW', search: 'budget', stalledOnly: false });
  });

  it('getPmQueue() has @Roles(PortfolioManager) metadata', () => {
    const reflector = new Reflector();
    const roles = reflector.get<Role[]>('roles', controller.getPmQueue);
    expect(roles).toContain(Role.PortfolioManager);
  });

  it('getDemandHistory() delegates to demandsService.getDemandHistory', async () => {
    await controller.getDemandHistory('d-1', mockPmUser as never);
    expect(demandsService.getDemandHistory).toHaveBeenCalledWith('d-1', 'pm-1', [Role.PortfolioManager]);
  });

  it('getDemandHistory() has @Roles covering all three roles', () => {
    const reflector = new Reflector();
    const roles = reflector.get<Role[]>('roles', controller.getDemandHistory);
    expect(roles).toContain(Role.DemandRequester);
    expect(roles).toContain(Role.DemandManager);
    expect(roles).toContain(Role.PortfolioManager);
  });

  it('pmApprove() delegates to demandsService.pmApprove', async () => {
    const dto = { assignedPmId: 'assigned-pm-1' };
    await controller.pmApprove('d-1', dto, mockPmUser as never);
    expect(demandsService.pmApprove).toHaveBeenCalledWith('d-1', 'pm-1', dto);
  });

  it('pmApprove() has @Roles(PortfolioManager) metadata', () => {
    const reflector = new Reflector();
    const roles = reflector.get<Role[]>('roles', controller.pmApprove);
    expect(roles).toContain(Role.PortfolioManager);
  });

  it('pmReject() delegates to demandsService.pmReject', async () => {
    await controller.pmReject('d-1', { pmCommentary: 'Not aligned' }, mockPmUser as never);
    expect(demandsService.pmReject).toHaveBeenCalledWith('d-1', 'pm-1', { pmCommentary: 'Not aligned' });
  });

  it('pmReject() has @Roles(PortfolioManager) metadata', () => {
    const reflector = new Reflector();
    const roles = reflector.get<Role[]>('roles', controller.pmReject);
    expect(roles).toContain(Role.PortfolioManager);
  });
});

describe('DemandsController — getDashboardStats (Story 4.6)', () => {
  let controller: DemandsController;
  let demandsService: { getDashboardStats: jest.Mock };

  const mockStatsResponse = {
    totalActiveDemands: 10,
    budgetCommittedCents: 500_000_00,
    budgetPlannedCents: 1_200_000_00,
    demandsPendingDecision: 4,
    stalledDemands: [],
  };

  beforeEach(async () => {
    demandsService = { getDashboardStats: jest.fn().mockResolvedValue(mockStatsResponse) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DemandsController],
      providers: [
        { provide: DemandsService, useValue: demandsService },
        { provide: FlagService, useValue: { get: jest.fn() } },
        { provide: AiService, useValue: { prefillDemand: jest.fn() } },
      ],
    }).overrideGuard(SessionAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<DemandsController>(DemandsController);
  });

  it('getDashboardStats() delegates to demandsService.getDashboardStats', async () => {
    const result = await controller.getDashboardStats();
    expect(demandsService.getDashboardStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockStatsResponse);
  });

  it('getDashboardStats() has @Roles(SECMember, Admin) metadata', () => {
    const reflector = new Reflector();
    const roles = reflector.get<Role[]>('roles', DemandsController.prototype.getDashboardStats);
    expect(roles).toContain(Role.SECMember);
    expect(roles).toContain(Role.Admin);
  });

  it('getDashboardStats() does not grant access to DemandRequester, DemandManager, or PortfolioManager', () => {
    const reflector = new Reflector();
    const roles = reflector.get<Role[]>('roles', DemandsController.prototype.getDashboardStats);
    expect(roles).not.toContain(Role.DemandRequester);
    expect(roles).not.toContain(Role.DemandManager);
    expect(roles).not.toContain(Role.PortfolioManager);
  });
});
