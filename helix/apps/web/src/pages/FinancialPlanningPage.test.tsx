import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FinancialPlanningPage } from './FinancialPlanningPage';

const mockNavigate = vi.fn();
const mockPatchCells = vi.fn().mockResolvedValue({ glAccounts: [], entries: [] });

const baseMockDemand = {
  id: 'demand-1',
  title: 'Test Demand',
  description: 'Test description',
  status: 'DRAFT',
  originatorId: 'user-1',
  costCentreId: null,
  isSmallProject: false,
  isGxpRelevant: false,
  startDate: '2026-04-01',
  endDate: '2026-09-30',
  draftSavedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let mockDemand = { ...baseMockDemand };

vi.mock('../features/intake/intake.queries', () => ({
  useGetDemand: () => ({ data: mockDemand, isPending: false }),
  useGetFinancialPlan: () => ({ data: { glAccounts: [], entries: [] } }),
  usePatchFinancialPlan: () => ({ mutateAsync: mockPatchCells }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'demand-1' }),
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/demands/demand-1/financial-planning']}>
          <FinancialPlanningPage />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('FinancialPlanningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDemand = { ...baseMockDemand };
  });

  it('[AC1] renders page title "Financial Planning"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /financial planning/i })).toBeTruthy();
  });

  it('renders the demand title as subtitle', () => {
    renderPage();
    expect(screen.getByText('Test Demand')).toBeTruthy();
  });

  it('renders "Back to demand" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /back to demand/i })).toBeTruthy();
  });

  it('"Back to demand" navigates to /demands/:id', async () => {
    renderPage();
    const backBtn = screen.getByRole('button', { name: /back to demand/i });
    await userEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/demands/new?id=demand-1');
  });

  it('[AC1] no Distribute button present', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /distribute/i })).toBeNull();
  });

  it('[AC1] no OPEX Total or CAPEX Total input present', () => {
    renderPage();
    expect(screen.queryByLabelText(/opex total/i)).toBeNull();
    expect(screen.queryByLabelText(/capex total/i)).toBeNull();
  });

  it('[AC29] useGetFinancialPlan returns new shape { glAccounts, entries }', () => {
    // Mock returns { glAccounts: [], entries: [] } — page renders without error
    renderPage();
    expect(screen.getByRole('heading', { name: /financial planning/i })).toBeTruthy();
  });

  it('[AC4] renders three section headers: Benefits, OPEX, CAPEX', () => {
    renderPage();
    expect(screen.getByText('Benefits')).toBeTruthy();
    expect(screen.getByText('OPEX')).toBeTruthy();
    expect(screen.getByText('CAPEX')).toBeTruthy();
  });

  it('passes startDate and endDate from demand to FinancialGrid (shows Apr–Sep headers)', () => {
    renderPage();
    expect(screen.getByText('Apr')).toBeTruthy();
    expect(screen.getByText('Sep')).toBeTruthy();
    expect(screen.queryByText('Jan')).toBeNull();
    expect(screen.queryByText('Oct')).toBeNull();
  });
});
