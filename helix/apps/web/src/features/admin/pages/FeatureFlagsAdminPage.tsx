import { useState } from 'react';
import {
  Table,
  Badge,
  Switch,
  Skeleton,
  Alert,
  Stack,
  Group,
  Text,
} from '@mantine/core';
import { IconFlag } from '@tabler/icons-react';
import { ListTableCard } from '../../../components/ListTableCard';
import { PageHeader } from '../../../components/PageHeader';
import { PageLayout } from '../../../components/PageLayout';
import { notifications } from '@mantine/notifications';
import { useAdminFeatureFlags } from '../hooks/useAdminFeatureFlags';
import { useToggleFeatureFlag } from '../hooks/useToggleFeatureFlag';

const FLAG_LABELS: Record<string, string> = {
  ai_prefill: 'AI Prefill',
};

const FLAG_DESCRIPTIONS: Record<string, string> = {
  ai_prefill: 'Enable AI-powered prefill for demand form fields. Requires signed Art. 28 DPA.',
};

export function FeatureFlagsAdminPage(): JSX.Element {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { data: rows, isPending, isError, refetch } = useAdminFeatureFlags();
  const toggleMutation = useToggleFeatureFlag();

  function handleToggle(key: string, currentValue: boolean) {
    if (pendingKey) return;
    setPendingKey(key);
    toggleMutation.mutate(
      { key, value: !currentValue },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Feature flag updated' });
        },
        onError: () => {
          notifications.show({ color: 'red', message: 'Failed to update feature flag' });
        },
        onSettled: () => {
          setPendingKey(null);
        },
      },
    );
  }

  return (
    <PageLayout>
      <Stack gap="md">
      <PageHeader title="Feature Flags" icon={<IconFlag size={22} />} />

      <Alert color="yellow">
        Changing feature flags takes effect on the next user session load. Changes are permanently recorded in the audit log.
      </Alert>

      {isPending && (
        <ListTableCard>
        <Table>
          <Table.Tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <Table.Tr key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </ListTableCard>
      )}

      {isError && (
        <Alert color="stadaRed" title="Failed to load feature flags">
          <Group>
            <Text
              size="sm"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => void refetch()}
            >
              Retry
            </Text>
          </Group>
        </Alert>
      )}

      {rows && (
        <ListTableCard>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Flag Name</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last Changed</Table.Th>
              <Table.Th>Changed By</Table.Th>
              <Table.Th>Toggle</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.key}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="sm" fw={500}>{FLAG_LABELS[row.key] ?? row.key}</Text>
                    <Text size="xs" c="dimmed">{FLAG_DESCRIPTIONS[row.key] ?? ''}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Badge color={row.value ? 'green' : 'gray'} variant="filled">
                    {row.value ? 'Enabled' : 'Disabled'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{new Date(row.updatedAt).toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{row.updatedByName ?? '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={row.value}
                    disabled={pendingKey === row.key}
                    onChange={() => handleToggle(row.key, row.value)}
                    aria-label={`Toggle ${FLAG_LABELS[row.key] ?? row.key}`}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </ListTableCard>
      )}
      </Stack>
    </PageLayout>
  );
}
