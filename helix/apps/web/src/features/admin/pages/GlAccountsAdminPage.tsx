import { Fragment, useState } from 'react';
import {
  Table,
  Badge,
  Button,
  Skeleton,
  Alert,
  Stack,
  Group,
  Text,
} from '@mantine/core';
import { IconCoin } from '@tabler/icons-react';
import { ListTableCard } from '../../../components/ListTableCard';
import { PageHeader } from '../../../components/PageHeader';
import { PageLayout } from '../../../components/PageLayout';
import { useDisclosure } from '@mantine/hooks';
import { GlAccountAdminRow, GlAccountCategory } from '@helix/shared';
import { useAdminGlAccounts } from '../hooks/useAdminGlAccounts';
import {
  useCreateGlAccount,
  useUpdateGlAccount,
  useDeactivateGlAccount,
  useActivateGlAccount,
} from '../hooks/useAdminGlAccountsMutations';
import {
  RefDataEntryModal,
  FormValues,
  FieldDescriptor,
  isConflictError,
} from '../components/RefDataEntryModal';

const CATEGORY_OPTIONS = [
  { value: 'benefits', label: 'Benefits' },
  { value: 'opex',     label: 'OPEX' },
  { value: 'capex',    label: 'CAPEX' },
];

const CATEGORY_LABELS: Record<string, string> = { benefits: 'Benefits', opex: 'OPEX', capex: 'CAPEX' };

const FIELDS: FieldDescriptor[] = [
  { key: 'code',        label: 'Code',        type: 'text' },
  { key: 'name',        label: 'Name',        type: 'text' },
  { key: 'description', label: 'Description', type: 'text',        required: false },
  { key: 'categories',  label: 'Categories',  type: 'multiselect', options: CATEGORY_OPTIONS },
];

export function GlAccountsAdminPage(): JSX.Element {
  const [modalOpen, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editTarget, setEditTarget] = useState<GlAccountAdminRow | null>(null);
  const [modalApiError, setModalApiError] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const { data: rows, isPending, isError, refetch } = useAdminGlAccounts();
  const { mutate: create, isPending: creating } = useCreateGlAccount();
  const { mutate: update, isPending: updating } = useUpdateGlAccount();
  const { mutate: deactivate, isPending: deactivating } = useDeactivateGlAccount();
  const { mutate: activate, isPending: activating } = useActivateGlAccount();

  const isSaving = creating || updating;

  function handleOpenAdd() {
    setEditTarget(null);
    setModalApiError(null);
    openModal();
  }

  function handleOpenEdit(row: GlAccountAdminRow) {
    setEditTarget(row);
    setModalApiError(null);
    openModal();
  }

  function handleSubmit(values: FormValues) {
    setModalApiError(null);
    const dto = {
      code:        values.code as string,
      name:        values.name as string,
      description: (values.description as string) || undefined,
      categories:  values.categories as GlAccountCategory[],
    };
    if (editTarget) {
      update(
        { id: editTarget.id, dto },
        {
          onSuccess: closeModal,
          onError: (err) => {
            if (isConflictError(err)) setModalApiError('An entry with this code already exists');
          },
        },
      );
    } else {
      create(dto, {
        onSuccess: closeModal,
        onError: (err) => {
          if (isConflictError(err)) setModalApiError('An entry with this code already exists');
        },
      });
    }
  }

  function handleDeactivate(id: string) {
    setDeactivateError(null);
    deactivate(id, {
      onError: () => setDeactivateError('Failed to deactivate. Please try again.'),
    });
  }

  function handleActivate(id: string) {
    activate(id);
  }

  return (
    <PageLayout>
      <Stack gap="md">
      <PageHeader title="GL Accounts" icon={<IconCoin size={22} />} actions={<Button color="stadaRed" onClick={handleOpenAdd}>Add Entry</Button>} />

      {isPending && (
        <Stack gap="xs">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} radius="sm" />
          ))}
        </Stack>
      )}

      {isError && (
        <Alert color="stadaRed" title="Failed to load GL accounts">
          <Button variant="subtle" size="compact-sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      )}

      {deactivateError && (
        <Alert color="stadaRed">{deactivateError}</Alert>
      )}

      {rows && (
        <ListTableCard>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Code</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Categories</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last Updated</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <Table.Tr style={!row.isActive ? { opacity: 0.6 } : undefined}>
                  <Table.Td>{row.code}</Table.Td>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{row.description ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {row.categories.map((c) => (
                        <Badge key={c} size="sm" variant="light">
                          {CATEGORY_LABELS[c] ?? c}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={row.isActive ? 'green' : 'gray'} variant="light">
                      {row.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {row.isActive && (
                        <>
                          <Button
                            size="compact-sm"
                            variant="light"
                            onClick={() => handleOpenEdit(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="compact-sm"
                            color="stadaRed"
                            variant="subtle"
                            loading={deactivating}
                            onClick={() => handleDeactivate(row.id)}
                          >
                            Deactivate
                          </Button>
                        </>
                      )}
                      {!row.isActive && (
                        <Button
                          size="compact-sm"
                          color="green"
                          variant="subtle"
                          loading={activating}
                          onClick={() => handleActivate(row.id)}
                        >
                          Activate
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              </Fragment>
            ))}
          </Table.Tbody>
        </Table>
        </ListTableCard>
      )}

      <RefDataEntryModal
        opened={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        isPending={isSaving}
        fields={FIELDS}
        initialValues={
          editTarget
            ? { code: editTarget.code, name: editTarget.name, description: editTarget.description ?? '', categories: editTarget.categories }
            : undefined
        }
        title={editTarget ? 'Edit GL Account' : 'Add GL Account'}
        apiError={modalApiError}
      />
      </Stack>
    </PageLayout>
  );
}
