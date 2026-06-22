import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DemandStatus } from '@helix/shared';
import { DemandDetailPage } from './DemandDetailPage';
import type { DemandResponse } from '@helix/shared';

vi.mock('../workflow/components/FinancialPlanModal', () => ({
  FinancialPlanModal: ({ opened, demand }: { opened: boolean; demand: { title: string } }) =>
    opened ? <div data-testid="financial-plan-modal">Modal for {demand.title}</div> : null,
}));

vi.mock('./intake.queries', () => ({
  useGetCostCentres: () => ({
    data: [{ id: 'cc-1', name: 'IT Department', code: 'IT001', demandManagerId: null }],
  }),
  useGetAreas: () => ({
    data: [{ id: 'area-1', name: 'Digital' }],
  }),
  useGetLegalEntities: () => ({
    data: [{ id: 'le-1', name: 'Stada SE' }],
  }),
  useGetPersons: () => ({
    data: [{ id: 'dm-1', name: 'Dana Manager', email: 'dm@example.com' }],
  }),
  useGetBcsByArea: () => ({
    data: [{ id: 'bc-1', name: 'Beth Controller', email: 'bc@example.com' }],
  }),
  useGetFinancialPlan: () => ({
    data: {
      glAccounts: [
        { id: 'opex-1', category: 'opex', label: 'Hosting', isActive: true },
        { id: 'capex-1', category: 'capex', label: 'Hardware', isActive: true },
      ],
      entries: [
        { id: 'e1', glAccountId: 'opex-1',  category: 'opex',  month: 1, year: 2026, valueCents: 100000, isActual: false, isUserSet: false },
        { id: 'e2', glAccountId: 'opex-1',  category: 'opex',  month: 2, year: 2026, valueCents: 200000, isActual: false, isUserSet: false },
        { id: 'e3', glAccountId: 'capex-1', category: 'capex', month: 1, year: 2026, valueCents: 50000,  isActual: false, isUserSet: false },
        { id: 'e4', glAccountId: 'capex-1', category: 'capex', month: 2, year: 2026, valueCents: 75000,  isActual: false, isUserSet: false },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock('../workflow/components/DemandHistoryList', () => ({
  DemandHistoryList: ({ demandId }: { demandId: string }) => (
    <div data-testid="demand-history-list" data-demand-id={demandId}>History List</div>
  ),
}));

const baseDemand: DemandResponse = {
  id: 'demand-1',
  publicId: 1,
  title: 'Cloud Migration Initiative',
  description: 'Migrate legacy systems to cloud',
  status: DemandStatus.SUBMITTED,
  originatorId: 'user-1',
  costCentreId: 'cc-1',
  glAccountId: null,
  startDate: '2026-07-01T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  draftSavedAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  legalEntityId: null,
  areaId: 'area-1',
  demandManagerId: 'dm-1',
  demandOwner: 'Alice',
  objective: null,
  necessity: null,
  isMandatory: false,
  qualitativeValueCategory: null,
  quantitativeValueCategory: null,
  asisDescription: null,
  benefitsObjectives: null,
  tobeDescription: null,
  isSmallProject: false,
  isGxpRelevant: true,
  projectType: 'P',
  submittedAt: '2026-06-03T09:30:00.000Z',
  dmCommentary: null,
  dmActionedBy: null,
  dmActionedAt: null,
  pmCommentary: null,
  pmActionedBy: null,
  pmActionedAt: null,
  projectId: null,
};

function renderDetail(demand: DemandResponse = baseDemand) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/demands/demand-1']}>
          <DemandDetailPage demand={demand} />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('DemandDetailPage', () => {
  // AC-2: no form inputs rendered
  it('AC-2: renders no input or textarea elements in the DOM', () => {
    renderDetail();
    expect(document.querySelectorAll('input')).toHaveLength(0);
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('AC-2: renders no form submit buttons', () => {
    renderDetail();
    expect(document.querySelectorAll('button[type="submit"]')).toHaveLength(0);
    expect(document.querySelectorAll('form')).toHaveLength(0);
  });

  // AC-3: header — title, badge, type, breadcrumb
  it('AC-3: shows demand title in a heading', () => {
    renderDetail();
    expect(screen.getByRole('heading', { name: /Cloud Migration Initiative/i })).toBeInTheDocument();
  });

  it('AC-3: shows Back to My Demands link', () => {
    renderDetail();
    const link = screen.getByRole('link', { name: /back to my demands/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/demands');
  });

  it('AC-3: shows DemandStatusBadge with correct label for SUBMITTED', () => {
    renderDetail();
    expect(screen.getByText('Pending DM Review')).toBeInTheDocument();
  });

  it('AC-3: shows type indicator for non-small-project (P)', () => {
    renderDetail();
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  // AC-4: StatusStepper
  it('AC-4: renders the status stepper element', () => {
    renderDetail();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // AC-5: key metadata read-only
  it('AC-5: shows cost centre name', () => {
    renderDetail();
    expect(screen.getByText('IT Department')).toBeInTheDocument();
  });

  it('AC-5: shows area name', () => {
    renderDetail();
    expect(screen.getByText('Digital')).toBeInTheDocument();
  });

  it('AC-5: shows GxP flag as Yes', () => {
    renderDetail();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('AC-5: shows GxP flag as No for non-GxP demand', () => {
    renderDetail({ ...baseDemand, isGxpRelevant: false });
    expect(screen.getAllByText('No').length).toBeGreaterThanOrEqual(1);
  });

  it('AC-5: shows OPEX total formatted from cents', () => {
    renderDetail();
    // totalOpex = 100000 + 200000 = 300000 cents = €3,000.00
    expect(screen.getByText('€3,000.00')).toBeInTheDocument();
  });

  it('AC-5: shows CAPEX total formatted from cents', () => {
    renderDetail();
    // totalCapex = 50000 + 75000 = 125000 cents = €1,250.00
    expect(screen.getByText('€1,250.00')).toBeInTheDocument();
  });

  it('AC-5: shows submitted-at timestamp (date portion)', () => {
    renderDetail();
    // dayjs formats in local time; multiple elements may contain this date (field grid + financial section)
    expect(screen.getAllByText(/03 Jun 2026/).length).toBeGreaterThanOrEqual(1);
  });

  // AC-6: DM commentary
  it('AC-6: DM Feedback callout absent when dmCommentary is null', () => {
    renderDetail();
    expect(screen.queryByTestId('dm-feedback')).not.toBeInTheDocument();
  });

  it('AC-6: DM Feedback callout present with commentary text when non-null', () => {
    renderDetail({ ...baseDemand, dmCommentary: 'Please add cost breakdown.' });
    const callout = screen.getByTestId('dm-feedback');
    expect(callout).toBeInTheDocument();
    expect(screen.getByText('Please add cost breakdown.')).toBeInTheDocument();
  });

  // AC-7: history section rendered
  it('AC-7: renders DemandHistoryList with correct demandId', () => {
    renderDetail();
    const historyList = screen.getByTestId('demand-history-list');
    expect(historyList).toBeInTheDocument();
    expect(historyList).toHaveAttribute('data-demand-id', 'demand-1');
  });

  // AC-4: REROUTED renders amber Returned label
  it('AC-4: REROUTED status shows "Returned" label from StatusStepper', () => {
    renderDetail({ ...baseDemand, status: DemandStatus.REROUTED });
    expect(screen.getByText('Returned')).toBeInTheDocument();
  });

  // DM name in stepper
  it('shows resolved DM name in the stepper when status is SUBMITTED', () => {
    renderDetail();
    // demandManagerId: 'dm-1' resolves to 'Dana Manager' via mocked useGetPersons
    expect(screen.getByText('Demand Manager (Dana Manager)')).toBeInTheDocument();
  });

  it('shows "Demand Manager" role fallback when DM cannot be resolved', () => {
    renderDetail({ ...baseDemand, demandManagerId: null });
    expect(screen.getByText('Demand Manager')).toBeInTheDocument();
  });

  it('shows "Portfolio Manager" as current actor when status is IN_REVIEW', () => {
    renderDetail({ ...baseDemand, status: DemandStatus.IN_REVIEW });
    expect(screen.getAllByText('Portfolio Manager').length).toBeGreaterThanOrEqual(1);
  });

  it('AC-4: shows "Approved" step in the stepper when status is APPROVED', () => {
    renderDetail({ ...baseDemand, status: DemandStatus.APPROVED });
    expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1);
  });

  it('AC-4: shows "Approved" as current actor when status is APPROVED', () => {
    renderDetail({ ...baseDemand, status: DemandStatus.APPROVED });
    expect(screen.getByText(/Current:/).textContent).toContain('Approved');
  });

  // Full demand fields
  it('shows demand description text when present', () => {
    renderDetail({ ...baseDemand, description: 'Migrate legacy systems to cloud' });
    expect(screen.getByText('Migrate legacy systems to cloud')).toBeInTheDocument();
  });

  it('shows demand owner field', () => {
    renderDetail({ ...baseDemand, demandOwner: 'Alice' });
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows objective long field when present', () => {
    renderDetail({ ...baseDemand, objective: 'Reduce operational cost by 20%' });
    expect(screen.getByText('Reduce operational cost by 20%')).toBeInTheDocument();
  });

  // AC-8: View Financial Planning button
  it('AC-8: renders "View Financial Planning" button in the Financial Plan section', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /View Financial Planning/i })).toBeInTheDocument();
  });

  it('AC-8: clicking "View Financial Planning" opens the modal', () => {
    renderDetail();
    expect(screen.queryByTestId('financial-plan-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Financial Planning/i }));
    expect(screen.getByTestId('financial-plan-modal')).toBeInTheDocument();
  });
});
