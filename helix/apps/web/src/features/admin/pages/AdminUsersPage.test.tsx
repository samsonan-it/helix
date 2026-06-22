import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { AdminUsersPage } from './AdminUsersPage';

vi.mock('../hooks/useAdminUsers', () => ({
  useAdminUsers: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
}));

vi.mock('../hooks/useUpdateUserStatus', () => ({
  useUpdateUserStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../intake/intake.queries', () => ({
  useGetCostCentres: () => ({
    data: [
      { id: 'cc-1', code: 'CC001', name: 'IT Department' },
      { id: 'cc-2', code: 'CC002', name: 'Finance' },
    ],
  }),
}));

vi.mock('../hooks/useAdminAreas', () => ({
  useAdminAreas: () => ({
    data: [
      { id: 'area-1', code: 'A-001', name: 'Digital', isActive: true },
    ],
  }),
}));

vi.mock('../hooks/useAdminCountries', () => ({
  useAdminCountries: () => ({ data: [] }),
}));

vi.mock('@mantine/modals', () => ({ modals: { openConfirmModal: vi.fn() } }));

vi.mock('../components/RoleAssignmentDrawer', () => ({
  RoleAssignmentDrawer: () => null,
}));

vi.mock('../components/AddUserModal', () => ({
  AddUserModal: () => null,
}));

function renderPage(search = '') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[`/admin/users${search}`]}>
        <AdminUsersPage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('AdminUsersPage — cost centre URL param', () => {
  it('pre-populates cost centre filter from ?costCentreId query param', () => {
    renderPage('?costCentreId=cc-1');
    const select = screen.getByPlaceholderText(/Filter by cost centre/i);
    expect(select).toHaveValue('IT Department');
  });

  it('leaves cost centre filter empty when no query param is present', () => {
    renderPage();
    const select = screen.getByPlaceholderText(/Filter by cost centre/i);
    expect(select).toHaveValue('');
  });
});
