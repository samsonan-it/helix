import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DemandStatus } from '@helix/shared';
import type { DemandResponse } from '@helix/shared';

// ─── Mock all hook dependencies ───────────────────────────────────────────────

const mockUpdateDates = vi.fn();
vi.mock('../../intake/intake.queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../intake/intake.queries')>();
  return {
    ...actual,
    useGetFinancialPlan:   () => ({ data: { entries: [{ glAccountId: 'opex-1', category: 'opex', month: 4, year: 2026, valueCents: 10000, isActual: false, isUserSet: true }], glAccounts: [{ id: 'opex-1', category: 'opex', label: 'Hosting', isActive: true }] }, isSuccess: true }),
    usePatchFinancialPlan: () => ({ mutate: vi.fn() }),
    useGetSystemSettings:  () => ({ data: { spThresholdEurCents: 5_000_000 } }),
    useUpdateDemandDates:  () => ({ mutate: mockUpdateDates, isPending: false }),
    useGetCostCentres:     () => ({ data: [] }),
    useGetLegalEntities:   () => ({ data: [] }),
    useGetAreas:           () => ({ data: [] }),
    useGetPersons:         () => ({ data: [] }),
    useGetGlAccounts:      () => ({ data: [] }),
    useGetBcsByArea:           () => ({ data: [] }),
    useSaveAssessmentDraft:    () => ({ mutate: vi.fn(), isPending: false }),
    defaultSystemSettings: { spThresholdEurCents: 5_000_000 },
  };
});

vi.mock('../hooks/useDmActions', () => ({
  useDmAccept:   () => ({ mutate: vi.fn(), isPending: false }),
  useDmReturn:   () => ({ mutate: vi.fn(), isPending: false }),
  useDmReject:   () => ({ mutate: vi.fn(), isPending: false }),
  useDmPostpone: () => ({ mutate: vi.fn(), isPending: false }),
  useDmResume:   () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/useSpActions', () => ({
  useSpAcceptAndEstimate:   () => ({ mutate: vi.fn(), isPending: false }),
  useConvertToSmallProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { DmReviewPanel } from './DmReviewPanel';

function makeSpDemand(overrides: Partial<DemandResponse> = {}): DemandResponse {
  return {
    id:                        'demand-1',
    publicId:                  1,
    title:                     'Test SP Demand',
    description:               'Description',
    status:                    DemandStatus.SUBMITTED,
    originatorId:              'user-1',
    costCentreId:              null,
    glAccountId:               null,
    startDate:                 null,
    endDate:                   null,
    draftSavedAt:              null,
    createdAt:                 '2026-01-01T00:00:00.000Z',
    updatedAt:                 '2026-01-01T00:00:00.000Z',
    legalEntityId:             null,
    areaId:                    null,
    demandManagerId:           null,
    demandOwner:               null,
    objective:                 null,
    necessity:                 null,
    isMandatory:               false,
    qualitativeValueCategory:  null,
    quantitativeValueCategory: null,
    asisDescription:           null,
    benefitsObjectives:        null,
    tobeDescription:           null,
    isSmallProject:            true,
    isGxpRelevant:             false,
    projectType:               'SP',
    submittedAt:               '2026-01-02T00:00:00.000Z',
    spStep:                    null,
    ...overrides,
  };
}

function renderPanel(demand: DemandResponse) {
  return render(
    <MantineProvider>
      <DmReviewPanel demand={demand} dmName="Test DM" onActionComplete={vi.fn()} />
    </MantineProvider>,
  );
}

// ─── AC-6: SP combined step — Accept button aria-disabled when datesValid=false ──

describe('[AC-6] SP combined step — Accept & Submit Estimate button', () => {
  beforeEach(() => {
    mockUpdateDates.mockReset();
  });

  it('is aria-disabled when demand has no dates set', () => {
    renderPanel(makeSpDemand({ startDate: null, endDate: null }));
    const btn = screen.getByRole('button', { name: /Accept & Submit Estimate/i });
    expect(btn).toHaveAttribute('aria-disabled');
  });

  it('shows inline "Correct the dates" message when demand has no dates', () => {
    renderPanel(makeSpDemand({ startDate: null, endDate: null }));
    expect(screen.getByText(/Correct the dates above to submit the estimate/i)).toBeTruthy();
  });

  it('does NOT show inline "Correct the dates" message when dates are valid', () => {
    renderPanel(makeSpDemand({ startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z' }));
    expect(screen.queryByText(/Correct the dates above/i)).toBeNull();
  });

  it('Accept button is not aria-disabled when demand has valid dates', () => {
    renderPanel(makeSpDemand({ startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z' }));
    const btn = screen.getByRole('button', { name: /Accept & Submit Estimate/i });
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });
});

// ─── AC-3: SP date fields re-sync when demand prop updates ───────────────────

describe('[AC-3] local date state re-syncs when demand prop changes', () => {
  it('Start Date field shows updated value after demand prop changes', () => {
    const { rerender } = renderPanel(makeSpDemand({ startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z' }));

    act(() => {
      rerender(
        <MantineProvider>
          <DmReviewPanel
            demand={makeSpDemand({ startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z' })}
            dmName="Test DM"
            onActionComplete={vi.fn()}
          />
        </MantineProvider>,
      );
    });

    // After rerender with new prop, verify the Accept button state reflects updated (valid) dates
    const btn = screen.getByRole('button', { name: /Accept & Submit Estimate/i });
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('Accept button stays aria-disabled after rerender with no dates', () => {
    const { rerender } = renderPanel(makeSpDemand({ startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z' }));

    act(() => {
      rerender(
        <MantineProvider>
          <DmReviewPanel
            demand={makeSpDemand({ startDate: null, endDate: null })}
            dmName="Test DM"
            onActionComplete={vi.fn()}
          />
        </MantineProvider>,
      );
    });

    const btn = screen.getByRole('button', { name: /Accept & Submit Estimate/i });
    expect(btn).toHaveAttribute('aria-disabled');
  });
});

// ─── AC-7: P demand — Edit Financial Planning button gated ───────────────────

describe('[AC-7] P demand — Edit Financial Planning button gated by dates', () => {
  function makePDemand(overrides: Partial<DemandResponse> = {}): DemandResponse {
    return makeSpDemand({ isSmallProject: false, projectType: 'P', ...overrides });
  }

  it('shows aria-disabled Edit Financial Planning button when dates are invalid', () => {
    renderPanel(makePDemand({ startDate: null, endDate: null }));
    const btn = screen.getByRole('button', { name: /Edit Financial Planning/i });
    expect(btn).toHaveAttribute('aria-disabled');
  });

  it('shows inline "Set valid start and end dates" message when P dates invalid', () => {
    renderPanel(makePDemand({ startDate: null, endDate: null }));
    expect(screen.getByText(/Set valid start and end dates/i)).toBeTruthy();
  });

  it('shows normal Edit Financial Planning button when P dates are valid', () => {
    renderPanel(makePDemand({ startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z' }));
    const btn = screen.getByRole('button', { name: /Edit Financial Planning/i });
    expect(btn).not.toHaveAttribute('aria-disabled');
  });
});
