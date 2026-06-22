import { useParams } from 'react-router-dom';
import { Alert, Anchor, Center, Skeleton, Stack } from '@mantine/core';
import { Link } from 'react-router-dom';
import { DemandStatus } from '@helix/shared';
import { DemandForm } from '../features/intake/DemandForm';
import { DemandDetailPage } from '../features/intake/DemandDetailPage';
import { useGetDemand } from '../features/intake/intake.queries';
import { useAuthStore } from '../stores/auth.store';
import { PageLayout } from '../components/PageLayout';

export function NewDemandPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: demand, isLoading, isError } = useGetDemand(id);

  if (!id) return <DemandForm />;

  if (isLoading) {
    return (
      <PageLayout>
        <Stack gap="sm">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={44} radius="xs" />)}
        </Stack>
      </PageLayout>
    );
  }

  if (isError || !demand) {
    return (
      <Center p="xl">
        <Alert color="stadaRed" title="Demand not found" maw={500}>
          This demand could not be loaded. Please try again or{' '}
          <Anchor component={Link} to="/demands">return to My Demands</Anchor>.
        </Alert>
      </Center>
    );
  }

  if (demand.originatorId === user?.id) {
    if (demand.status === DemandStatus.DRAFT || demand.status === DemandStatus.REROUTED) {
      return <DemandForm />;
    }
    return <DemandDetailPage demand={demand} />;
  }

  return <DemandDetailPage demand={demand} />;
}
