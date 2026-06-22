import { useParams, useNavigate, Link } from 'react-router-dom';
import { Anchor, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useProject } from '../features/execution/hooks/useProject';
import { useStatusReports } from '../features/execution/hooks/useStatusReports';
import { StatusReportForm } from '../features/execution/components/StatusReportForm';

const ACTIVE_STATUSES = ['IN_EXECUTION', 'ASSUMED_COMPLETED'];

export function StatusReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id ?? null);
  const isActive = !!project && ACTIVE_STATUSES.includes(project.status);
  const { data: statusReports, isLoading: reportsLoading } = useStatusReports(isActive ? (id ?? null) : null);
  const latestReport = statusReports?.[0] ?? null;

  if (projectLoading || reportsLoading) {
    return (
      <Stack p="md" align="center" justify="center" h={300}>
        <Loader />
      </Stack>
    );
  }

  if (!project) {
    return (
      <Stack p="md">
        <Text c="dimmed">Project not found</Text>
      </Stack>
    );
  }

  if (!isActive) {
    return (
      <Stack p="md" maw={720} mx="auto">
        <Group>
          <Anchor component={Link} to={`/projects?id=${id}`}>
            ← Back to project
          </Anchor>
        </Group>
        <Text c="dimmed">
          Status reporting is not available until the project charter is approved.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack p="md" maw={720} mx="auto">
      <Group>
        <Anchor component="button" onClick={() => navigate(`/projects?id=${id}`)}>
          ← Back to project
        </Anchor>
        <Title order={4}>{project.title} — Status Report</Title>
      </Group>
      <StatusReportForm project={project} latestReport={latestReport} />
    </Stack>
  );
}
