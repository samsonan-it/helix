import { useParams, Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useGetDemand, useGetPersons } from '../features/intake/intake.queries';
import { DemandTypeIndicator } from '../components/DemandTypeIndicator';

export function DemandConfirmationPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: demand, isLoading } = useGetDemand(id);
  const { data: persons = [], isLoading: personsLoading } = useGetPersons();

  const dm = demand?.demandManagerId
    ? persons.find(p => p.id === demand.demandManagerId)
    : undefined;

  if (isLoading || personsLoading) return <Center h="100vh"><Loader /></Center>;
  if (!demand) return <Navigate to="/" replace />;
  if (demand.status !== 'SUBMITTED') return <Navigate to={`/demands/new?id=${demand.id}`} replace />;

  return (
    <Stack gap="lg" p="xl" maw={600} mx="auto" ta="center">
      <Title order={2}>Demand Submitted</Title>
      <Group justify="center" gap="sm">
        <Text fw={600}>{demand.title}</Text>
        <DemandTypeIndicator type={demand.projectType} />
      </Group>
      <Text c="dimmed">
        {dm
          ? `Your demand is now with ${dm.name} for initial review.`
          : 'Your demand is now with your Demand Manager for initial review.'}
      </Text>
      <Button onClick={() => navigate('/')} color="stadaRed">
        Back to Dashboard
      </Button>
    </Stack>
  );
}
