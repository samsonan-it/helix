import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { RoutingHealthPage } from './RoutingHealthPage';
import type { RoutingHealthResponse } from '@helix/shared';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../hooks/useRoutingHealth', () => ({
  useRoutingHealth: vi.fn(),
}));

import { useRoutingHealth } from '../hooks/useRoutingHealth';

const mockUseRoutingHealth = useRoutingHealth as ReturnType<typeof vi.fn>;

const areaWithDmGap: RoutingHealthResponse['areaHealth'][0] = {
  areaId: 'area-1',
  areaCode: 'A-001',
  areaName: 'IT Department',
  demandManager: null,
  businessController: null,
  hasDmGap: true,
  hasBcGap: true,
};

const areaHealthy: RoutingHealthResponse['areaHealth'][0] = {
  areaId: 'area-2',
  areaCode: 'A-002',
  areaName: 'Finance',
  demandManager: { id: 'dm-1', name: 'Dana DM', email: 'dana@example.com' },
  businessController: { id: 'bc-1', name: 'Bob BC', email: 'bob@example.com' },
  hasDmGap: false,
  hasBcGap: false,
};

const ccHealthy: RoutingHealthResponse['costCentreHealth'][0] = {
  costCentreId: 'cc-1',
  code: 'CC001',
  name: 'IT CC',
  demandManagers: [],
  portfolioManagers: [{ userId: 'pm-1', name: 'Paula PM' }],
  hasDmGap: false,
  hasPmGap: false,
};

const emptyResponse: RoutingHealthResponse = {
  costCentreHealth: [],
  areaHealth: [],
};

function makeResponse(overrides: Partial<RoutingHealthResponse> = {}): RoutingHealthResponse {
  return { ...emptyResponse, ...overrides };
}

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <RoutingHealthPage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('RoutingHealthPage', () => {
  beforeEach(() => { mockNavigate.mockClear(); });

  it('AC2: shows DM gap count alert when gaps exist', () => {
    mockUseRoutingHealth.mockReturnValue({ data: makeResponse({ areaHealth: [areaWithDmGap, areaHealthy] }), isPending: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText(/1 area without a Demand Manager/i)).toBeInTheDocument();
  });

  it('AC2: pluralises gap count correctly for multiple gaps', () => {
    const area2 = { ...areaWithDmGap, areaId: 'area-3', areaCode: 'A-003', areaName: 'HR' };
    mockUseRoutingHealth.mockReturnValue({ data: makeResponse({ areaHealth: [areaWithDmGap, area2, areaHealthy] }), isPending: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText(/2 areas without a Demand Manager/i)).toBeInTheDocument();
  });

  it('AC3: shows healthy banner for areas when all configured', () => {
    mockUseRoutingHealth.mockReturnValue({ data: makeResponse({ areaHealth: [areaHealthy] }), isPending: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText(/All areas are correctly configured/i)).toBeInTheDocument();
  });

  it('AC3: does not show healthy banner when gaps exist', () => {
    mockUseRoutingHealth.mockReturnValue({ data: makeResponse({ areaHealth: [areaWithDmGap, areaHealthy] }), isPending: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.queryByText(/All areas are correctly configured/i)).not.toBeInTheDocument();
  });

  it('AC4 (area): gap row navigates to /admin/users with areaId on click', async () => {
    mockUseRoutingHealth.mockReturnValue({ data: makeResponse({ areaHealth: [areaWithDmGap] }), isPending: false, isError: false, refetch: vi.fn() });
    renderPage();
    const row = screen.getByText('IT Department').closest('tr')!;
    await userEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/users?areaId=area-1');
  });

  it('AC4: healthy area row does not navigate on click', async () => {
    mockUseRoutingHealth.mockReturnValue({ data: makeResponse({ areaHealth: [areaHealthy] }), isPending: false, isError: false, refetch: vi.fn() });
    renderPage();
    const row = screen.getByText('Finance').closest('tr')!;
    await userEvent.click(row);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('PM section: shows PM gap count alert when gaps exist', () => {
    const ccWithGap = { ...ccHealthy, portfolioManagers: [], hasPmGap: true };
    mockUseRoutingHealth.mockReturnValue({ data: makeResponse({ costCentreHealth: [ccWithGap] }), isPending: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText(/1 cost centre without a Portfolio Manager/i)).toBeInTheDocument();
  });

  it('shows loading skeletons while pending', () => {
    mockUseRoutingHealth.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: vi.fn() });
    renderPage();
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
  });

  it('shows error alert when fetch fails', () => {
    mockUseRoutingHealth.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText(/Failed to load routing health/i)).toBeInTheDocument();
  });
});
