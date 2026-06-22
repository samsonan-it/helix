import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Table,
  Badge,
  Button,
  Skeleton,
  Alert,
  Text,
  Stack,
  Group,
  TextInput,
  Select,
} from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { ListTableCard } from '../../../components/ListTableCard';
import { PageHeader } from '../../../components/PageHeader';
import { PageLayout } from '../../../components/PageLayout';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { UserAdminRow, VALID_ROLES } from '@helix/shared';
import { useAdminUsers } from '../hooks/useAdminUsers';
import { useUpdateUserStatus } from '../hooks/useUpdateUserStatus';
import { RoleAssignmentDrawer } from '../components/RoleAssignmentDrawer';
import { AddUserModal } from '../components/AddUserModal';
import { formatRoles } from '../utils/formatRoles';
import { useGetCostCentres } from '../../intake/intake.queries';
import { useAdminAreas } from '../hooks/useAdminAreas';
import { useAdminCountries } from '../hooks/useAdminCountries';

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  departed: 'gray',
  retention_only: 'orange',
};

export function AdminUsersPage(): JSX.Element {
  const [selectedUser, setSelectedUser] = useState<UserAdminRow | null>(null);
  const [addUserOpened, { open: openAddUser, close: closeAddUser }] = useDisclosure(false);

  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [ccFilter, setCcFilter] = useState<string | null>(searchParams.get('costCentreId'));
  const [areaFilter, setAreaFilter] = useState<string | null>(searchParams.get('areaId'));
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    const ccParam = searchParams.get('costCentreId');
    if (ccParam) setCcFilter(ccParam);
    const areaParam = searchParams.get('areaId');
    if (areaParam) setAreaFilter(areaParam);
  }, [searchParams]);

  const params = {
    search: debouncedSearch || undefined,
    role: roleFilter ?? undefined,
    costCentreId: ccFilter ?? undefined,
    areaId: areaFilter ?? undefined,
  };

  const { data: users, isPending, isError, refetch } = useAdminUsers(params);
  const { data: costCentres = [] } = useGetCostCentres();
  const { data: adminAreas = [] } = useAdminAreas();
  const { data: adminCountries = [] } = useAdminCountries();
  const { mutate: updateStatus, isPending: statusPending } = useUpdateUserStatus();

  const hasActiveFilters = Boolean(debouncedSearch || roleFilter || ccFilter || areaFilter);

  function handleDeactivate(user: UserAdminRow) {
    modals.openConfirmModal({
      title: 'Deactivate user?',
      children: 'This user will no longer be able to access Helix. You can reactivate them later.',
      labels: { confirm: 'Deactivate', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => updateStatus({ userId: user.id, dto: { status: 'departed' } }),
    });
  }

  function handleReactivate(user: UserAdminRow) {
    modals.openConfirmModal({
      title: 'Reactivate user?',
      children: 'This user will regain access based on their current role assignments.',
      labels: { confirm: 'Reactivate', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: () => updateStatus({ userId: user.id, dto: { status: 'active' } }),
    });
  }

  return (
    <PageLayout>
      <Stack gap="md">
      <PageHeader title="User Management" icon={<IconUsers size={22} />} actions={<Button color="stadaRed" onClick={openAddUser}>Add User</Button>} />

      <Group gap="sm">
        <TextInput
          placeholder="Search by name or email…"
          w={240}
          value={searchInput}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
        <Select
          placeholder="Filter by role"
          data={VALID_ROLES as unknown as string[]}
          clearable
          value={roleFilter}
          onChange={setRoleFilter}
        />
        <Select
          placeholder="Filter by cost centre"
          data={costCentres.map((cc) => ({ value: cc.id, label: cc.name }))}
          clearable
          searchable
          value={ccFilter}
          onChange={setCcFilter}
        />
        <Select
          placeholder="Filter by area"
          data={adminAreas.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
          clearable
          searchable
          value={areaFilter}
          onChange={setAreaFilter}
        />
      </Group>

      {hasActiveFilters && users && (
        <Text size="sm" c="dimmed">Showing {users.length} users</Text>
      )}

      {isPending && (
        <Stack gap="xs">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} radius="sm" />
          ))}
        </Stack>
      )}

      {isError && (
        <Alert color="stadaRed" title="Failed to load users">
          <Button variant="subtle" size="compact-sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      )}

      {users && (
        <ListTableCard>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Current Roles</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>{user.name}</Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLORS[user.status] ?? 'gray'} variant="light">
                    {user.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatRoles(user.assignments, costCentres, adminAreas, adminCountries)}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {user.status === 'active' && (
                      <Button
                        size="compact-sm"
                        color="stadaRed"
                        variant="subtle"
                        disabled={statusPending}
                        onClick={() => handleDeactivate(user)}
                      >
                        Deactivate
                      </Button>
                    )}
                    {user.status === 'departed' && (
                      <Button
                        size="compact-sm"
                        color="green"
                        variant="subtle"
                        disabled={statusPending}
                        onClick={() => handleReactivate(user)}
                      >
                        Reactivate
                      </Button>
                    )}
                    <Button
                      size="compact-sm"
                      variant="light"
                      onClick={() => setSelectedUser(user)}
                    >
                      Manage Roles
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </ListTableCard>
      )}

      <RoleAssignmentDrawer
        user={selectedUser}
        opened={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
      />

      <AddUserModal opened={addUserOpened} onClose={closeAddUser} />
      </Stack>
    </PageLayout>
  );
}
