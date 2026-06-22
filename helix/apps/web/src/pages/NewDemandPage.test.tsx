import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DemandStatus } from '@helix/shared';
import { NewDemandPage } from './NewDemandPage';

vi.mock('../features/intake/DemandForm', () => ({
  DemandForm: () => <div data-testid="demand-form">DemandForm</div>,
}));

vi.mock('../features/intake/DemandDetailPage', () => ({
  DemandDetailPage: ({ demand }: { demand: { id: string } }) => (
    <div data-testid="demand-detail-page" data-demand-id={demand.id}>DemandDetailPage</div>
  ),
}));

const mockUser = { id: 'user-1', name: 'Alice', email: 'alice@test.com', roles: [] };
let mockGetDemandResult: { data: unknown; isLoading: boolean; isError: boolean } = {
  data: undefined,
  isLoading: false,
  isError: false,
};

vi.mock('../features/intake/intake.queries', () => ({
  useGetDemand: () => mockGetDemandResult,
}));

vi.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: typeof mockUser }) => unknown) => selector({ user: mockUser }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'demand-1' }),
  };
});

const baseDemand = {
  id: 'demand-1',
  title: 'Test',
  status: DemandStatus.SUBMITTED,
  originatorId: 'user-1',
  isSmallProject: false,
  projectType: 'P',
  dmCommentary: null,
  pmActionedBy: null,
  isGxpRelevant: false,
  costCentreId: null,
  areaId: null,
  startDate: null,
  endDate: null,
  submittedAt: '2026-06-03T09:30:00.000Z',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/demands/demand-1']}>
          <NewDemandPage />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('NewDemandPage dispatch', () => {
  beforeEach(() => {
    mockGetDemandResult = { data: undefined, isLoading: false, isError: false };
  });

  // AC-1: DRAFT → DemandForm
  it('AC-1: renders DemandForm for DRAFT status originator', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.DRAFT },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-form')).toBeInTheDocument();
    expect(screen.queryByTestId('demand-detail-page')).not.toBeInTheDocument();
  });

  // AC-2: SUBMITTED → DemandDetailPage (no form)
  it('AC-2: renders DemandDetailPage for SUBMITTED status originator', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.SUBMITTED },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('demand-form')).not.toBeInTheDocument();
  });

  // AC-8: REROUTED → DemandForm (editable)
  it('AC-8: renders DemandForm for REROUTED status originator', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.REROUTED, dmCommentary: 'Needs rework' },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-form')).toBeInTheDocument();
    expect(screen.queryByTestId('demand-detail-page')).not.toBeInTheDocument();
  });

  // AC-2: APPROVED → DemandDetailPage
  it('AC-2: renders DemandDetailPage for APPROVED status', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.APPROVED },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-detail-page')).toBeInTheDocument();
  });

  // AC-2: REJECTED → DemandDetailPage
  it('AC-2: renders DemandDetailPage for REJECTED status', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.REJECTED },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-detail-page')).toBeInTheDocument();
  });

  // AC-2: ON_HOLD → DemandDetailPage
  it('AC-2: renders DemandDetailPage for ON_HOLD status', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.ON_HOLD },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('demand-form')).not.toBeInTheDocument();
  });

  // AC-2: IN_EXECUTION → DemandDetailPage
  it('AC-2: renders DemandDetailPage for IN_EXECUTION status', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.IN_EXECUTION },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('demand-form')).not.toBeInTheDocument();
  });

  // AC-2: COMPLETED → DemandDetailPage
  it('AC-2: renders DemandDetailPage for COMPLETED status', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.COMPLETED },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('demand-form')).not.toBeInTheDocument();
  });

  // AC-2: CANCELLED → DemandDetailPage
  it('AC-2: renders DemandDetailPage for CANCELLED status', () => {
    mockGetDemandResult = {
      data: { ...baseDemand, status: DemandStatus.CANCELLED },
      isLoading: false,
      isError: false,
    };
    renderPage();
    expect(screen.getByTestId('demand-detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('demand-form')).not.toBeInTheDocument();
  });

  // AC-10: loading skeleton
  it('AC-10: renders neither form nor detail page while loading', () => {
    mockGetDemandResult = { data: undefined, isLoading: true, isError: false };
    renderPage();
    expect(screen.queryByTestId('demand-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('demand-detail-page')).not.toBeInTheDocument();
  });

  // AC-10: error state
  it('AC-10: renders error message on fetch failure', () => {
    mockGetDemandResult = { data: undefined, isLoading: false, isError: true };
    renderPage();
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to my demands/i })).toBeInTheDocument();
  });
});
