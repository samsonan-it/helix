import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { FinancialGrid } from '@helix/ui';
import {
  useGetDemand,
  useGetFinancialPlan,
  usePatchFinancialPlan,
} from '../features/intake/intake.queries';

export function FinancialPlanningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: demand, isPending: demandLoading } = useGetDemand(id);
  const { data = { glAccounts: [], entries: [] } } = useGetFinancialPlan(id);
  const patchMutation = usePatchFinancialPlan();

  if (demandLoading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  if (!demand) {
    return (
      <Stack p="md" gap="sm">
        <Text c="red">Demand not found.</Text>
        <Button variant="subtle" onClick={() => navigate('/demands')}>
          Go to demands
        </Button>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="md">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(`/demands/new?id=${id}`)}
        >
          Back to demand
        </Button>
      </Group>

      <Title order={3}>Financial Planning</Title>
      <Text c="dimmed" size="sm">{demand.title}</Text>

      <FinancialGrid
        glAccounts={data.glAccounts}
        entries={data.entries}
        startDate={demand.startDate ?? null}
        endDate={demand.endDate ?? null}
        onCellChange={(glAccountId, category, month, year, valueCents) => {
          patchMutation
            .mutateAsync({ demandId: id!, dto: { entries: [{ glAccountId, category, month, year, valueCents }] } })
            .catch(() => {
              notifications.show({ color: 'red', title: 'Could not save', message: 'Could not save — please try again.' });
            });
        }}
      />
    </Stack>
  );
}
