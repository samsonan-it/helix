import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DemandsPage } from './DemandsPage';
import { Role } from '@helix/types';

const mockNavigate = vi.fn();
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);

// jsdom in this project doesn't expose localStorage as a global — stub it
const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); },
};
vi.stubGlobal('localStorage', mockLocalStorage);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../features/intake/intake.queries', () => ({
  useDeleteDemand: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
}));

const mockUser = { id: 'user-1', name: 'Alice', email: 'alice@test.com', roles: [Role.DemandRequester] };

vi.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: typeof mockUser }) => unknown) => selector({ user: mockUser }),
}));

vi.mock('../features/workflow/api/workflow.api', () => ({
  getMyDemands: vi.fn().mockResolvedValue([{
    id: 'draft-1',
    title: 'Draft Demand',
    status: 'DRAFT',
    originatorId: 'user-1',
    projectType: 'P',
    updatedAt: '2026-06-01T10:00:00.000Z',
    costCentreId: null,
  }]),
}));

vi.mock('../lib/queryKeys', () => ({
  queryKeys: {
    demands: {
      myList: (_params: unknown) => ['demands', 'myList', _params],
    },
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DemandsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

async function goToDraftsTab() {
  const tab = screen.getByRole('tab', { name: /drafts/i });
  fireEvent.click(tab);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^select$/i })).toBeTruthy();
  });
}

describe('DemandsPage — Story 4.10 selection mode (AC-4, AC-5)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockDeleteMutateAsync.mockClear();
    mockLocalStorage.clear();
  });

  it('[AC-4] "Select" button is visible on Drafts tab and checkboxes are NOT visible by default', async () => {
    renderPage();
    await goToDraftsTab();
    expect(screen.getByRole('button', { name: /^select$/i })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('[AC-4] clicking "Select" enters selection mode — checkboxes appear and button becomes "Cancel"', async () => {
    renderPage();
    await goToDraftsTab();
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }));
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeTruthy();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  it('[AC-4] clicking "Cancel" exits selection mode — checkboxes disappear', async () => {
    renderPage();
    await goToDraftsTab();
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: /^select$/i })).toBeTruthy();
  });

  it('[AC-5] "Delete selected" button is NOT visible when no rows are checked', async () => {
    renderPage();
    await goToDraftsTab();
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }));
    expect(screen.queryByRole('button', { name: /delete selected/i })).toBeNull();
  });

  it('[AC-5] "Delete selected" button appears when a row is checked', async () => {
    renderPage();
    await goToDraftsTab();
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }));
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeTruthy();
  });

  it('[AC-5] "Delete selected" button disappears when all rows are deselected', async () => {
    renderPage();
    await goToDraftsTab();
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }));
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeTruthy();
    fireEvent.click(checkbox);
    expect(screen.queryByRole('button', { name: /delete selected/i })).toBeNull();
  });

  it('[AC-4] "Select" button is NOT rendered on Active tab (default)', () => {
    renderPage();
    // Default tab is 'active' (no localStorage value), so no Select button
    expect(screen.queryByRole('button', { name: /^select$/i })).toBeNull();
  });
});
