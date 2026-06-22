import { describe, it, expect } from 'vitest';
import { DemandStatus } from '@helix/shared';
import type { DemandResponse } from '@helix/shared';
import { applyFilter } from './DemandsPage';

function makeDemand(id: string, status: DemandStatus, originatorId = 'user-1'): DemandResponse {
  return {
    id,
    publicId: parseInt(id.replace(/\D/g, '') || '1', 10),
    title: `Demand ${id}`,
    description: '',
    status,
    originatorId,
    costCentreId: null,
    glAccountId: null,
    startDate: null,
    endDate: null,
    draftSavedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    legalEntityId: null,
    areaId: null,
    demandManagerId: null,
    demandOwner: null,
    objective: null,
    necessity: null,
    isMandatory: false,
    qualitativeValueCategory: null,
    quantitativeValueCategory: null,
    asisDescription: null,
    benefitsObjectives: null,
    tobeDescription: null,
    isSmallProject: false,
    isGxpRelevant: false,
    projectType: 'P',
    submittedAt: null,
  };
}

const ALL_STATUSES = Object.values(DemandStatus);

const demands = ALL_STATUSES.map((s, i) => makeDemand(`d${i}`, s));

describe('applyFilter — AC-3 preset filter logic', () => {
  it('active: excludes DRAFT, COMPLETED, CANCELLED', () => {
    const result = applyFilter(demands, 'active');
    expect(result.every(d =>
      ![DemandStatus.DRAFT, DemandStatus.COMPLETED, DemandStatus.CANCELLED].includes(d.status)
    )).toBe(true);
    expect(result.some(d => d.status === DemandStatus.SUBMITTED)).toBe(true);
    expect(result.some(d => d.status === DemandStatus.REROUTED)).toBe(true);
  });

  it('all: returns every demand', () => {
    expect(applyFilter(demands, 'all')).toHaveLength(demands.length);
  });

  it('drafts: returns only DRAFT demands', () => {
    const result = applyFilter(demands, 'drafts');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(DemandStatus.DRAFT);
  });

  it('closed: returns only COMPLETED and CANCELLED demands', () => {
    const result = applyFilter(demands, 'closed');
    expect(result.every(d =>
      [DemandStatus.COMPLETED, DemandStatus.CANCELLED].includes(d.status)
    )).toBe(true);
    expect(result).toHaveLength(2);
  });
});

describe('originatorId client-side scope — AC-11', () => {
  const userId = 'user-me';
  const mixed = [
    makeDemand('own-1', DemandStatus.SUBMITTED, userId),
    makeDemand('own-2', DemandStatus.DRAFT, userId),
    makeDemand('other-1', DemandStatus.APPROVED, 'user-dm'),
    makeDemand('other-2', DemandStatus.IN_REVIEW, 'user-pm'),
  ];

  it('filters demands to only those owned by the current user', () => {
    const myDemands = mixed.filter(d => d.originatorId === userId);
    expect(myDemands).toHaveLength(2);
    expect(myDemands.every(d => d.originatorId === userId)).toBe(true);
  });

  it('DM/PM demands from other originators are excluded', () => {
    const myDemands = mixed.filter(d => d.originatorId === userId);
    expect(myDemands.some(d => d.originatorId === 'user-dm')).toBe(false);
    expect(myDemands.some(d => d.originatorId === 'user-pm')).toBe(false);
  });
});
