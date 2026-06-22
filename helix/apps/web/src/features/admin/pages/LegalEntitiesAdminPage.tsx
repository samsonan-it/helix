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
import { IconBriefcase } from '@tabler/icons-react';
import { ListTableCard } from '../../../components/ListTableCard';
import { PageHeader } from '../../../components/PageHeader';
import { PageLayout } from '../../../components/PageLayout';
import { useDisclosure } from '@mantine/hooks';
import { LegalEntityAdminRow } from '@helix/shared';
import { useAdminLegalEntities } from '../hooks/useAdminLegalEntities';
import {
  useCreateLegalEntity,
  useUpdateLegalEntity,
  useDeactivateLegalEntity,
  useActivateLegalEntity,
} from '../hooks/useAdminLegalEntitiesMutations';
import {
  RefDataEntryModal,
  FormValues,
  FieldDescriptor,
  isConflictError,
  isBlockersError,
  getBlockers,
} from '../components/RefDataEntryModal';

const FIELDS: FieldDescriptor[] = [
  { key: 'code', label: 'Code', type: 'text' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
  { key: 'mandatoryTimesheeting', label: 'Mandatory Timesheeting', type: 'checkbox' },
];

export function LegalEntitiesAdminPage(): JSX.Element {
  const [modalOpen, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editTarget, setEditTarget] = useState<LegalEntityAdminRow | null>(null);
  const [modalApiError, setModalApiError] = useState<string | null>(null);
  const [deactivateBlockerMap, setDeactivateBlockerMap] = useState<
    Record<string, { id: string; title: string; status: string }[]>
  >({});

  const { data: rows, isPending, isError, refetch } = useAdminLegalEntities();
  const { mutate: create, isPending: creating } = useCreateLegalEntity();
  const { mutate: update, isPending: updating } = useUpdateLegalEntity();
  const { mutate: deactivate, isPending: deactivating } = useDeactivateLegalEntity();
  const { mutate: activate, isPending: activating } = useActivateLegalEntity();

  const isSaving = creating || updating;

  function handleOpenAdd() {
    setEditTarget(null);
    setModalApiError(null);
    openModal();
  }

  function handleOpenEdit(row: LegalEntityAdminRow) {
    setEditTarget(row);
    setModalApiError(null);
    openModal();
  }

  function handleSubmit(values: FormValues) {
    setModalApiError(null);
    const dto = {
      code: values.code as string,
      name: values.name as string,
      country: values.country as string,
      mandatoryTimesheeting: values.mandatoryTimesheeting as boolean,
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

  function handleDeactivate(row: LegalEntityAdminRow) {
    setDeactivateBlockerMap((prev) => ({ ...prev, [row.id]: [] }));
    deactivate(row.id, {
      onSuccess: () =>
        setDeactivateBlockerMap((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        }),
      onError: (err) => {
        if (isBlockersError(err)) {
          setDeactivateBlockerMap((prev) => ({ ...prev, [row.id]: getBlockers(err) }));
        } else {
          setDeactivateBlockerMap((prev) => {
            const next = { ...prev };
            delete next[row.id];
            return next;
          });
        }
      },
    });
  }

  function handleActivate(id: string) {
    activate(id);
  }

  return (
    <PageLayout>
      <Stack gap="md">
      <PageHeader title="Legal Entities" icon={<IconBriefcase size={22} />} actions={<Button color="stadaRed" onClick={handleOpenAdd}>Add Entry</Button>} />

      {isPending && (
        <Stack gap="xs">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} radius="sm" />
          ))}
        </Stack>
      )}

      {isError && (
        <Alert color="stadaRed" title="Failed to load legal entities">
          <Button variant="subtle" size="compact-sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      )}

      {rows && (
        <ListTableCard>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Code</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Country</Table.Th>
              <Table.Th>Timesheeting</Table.Th>
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
                  <Table.Td>{row.country}</Table.Td>
                  <Table.Td>
                    <Badge color={row.mandatoryTimesheeting ? 'blue' : 'gray'} variant="light">
                      {row.mandatoryTimesheeting ? 'Mandatory' : 'Optional'}
                    </Badge>
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
                            onClick={() => handleDeactivate(row)}
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
                {deactivateBlockerMap[row.id]?.length > 0 && (
                  <Table.Tr key={`${row.id}-blockers`}>
                    <Table.Td colSpan={7}>
                      <Alert color="stadaRed">
                        {`Cannot deactivate — ${deactivateBlockerMap[row.id].length} in-flight demand(s): [${deactivateBlockerMap[row.id].map((b) => `${b.title} (${b.status})`).join(', ')}]`}
                      </Alert>
                    </Table.Td>
                  </Table.Tr>
                )}
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
            ? {
                code: editTarget.code,
                name: editTarget.name,
                country: editTarget.country ?? '',
                mandatoryTimesheeting: editTarget.mandatoryTimesheeting,
              }
            : undefined
        }
        title={editTarget ? 'Edit Legal Entity' : 'Add Legal Entity'}
        apiError={modalApiError}
      />
      </Stack>
    </PageLayout>
  );
}
