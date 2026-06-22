import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Flex,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Role } from '@helix/types';
import { useProject } from '../features/execution/hooks/useProject';
import { useUpdateCurrentStage } from '../features/execution/hooks/useUpdateCurrentStage';
import { useAuthStore } from '../stores/auth.store';
import { ProjectStatusBadge } from '../features/execution/components/ProjectStatusBadge';
import { ProjectStatusStepper } from '../features/execution/components/ProjectStatusStepper';
import { CharterApprovalPanel } from '../features/execution/components/CharterApprovalPanel';
import { CharterForm } from '../features/execution/components/CharterForm';
import { ClosureForm } from '../features/execution/components/ClosureForm';
import { ClosureReviewPanel } from '../features/execution/components/ClosureReviewPanel';
import { FinancialPlanSection } from '../features/execution/components/FinancialPlanSection';
import { PlanBoard } from '../features/execution/components/PlanBoard';
import { DemandTypeIndicator } from '../components/DemandTypeIndicator';
import { CopyLinkButton } from '../components/CopyLinkButton';
import { ProjectHistoryList } from '../features/execution/components/ProjectHistoryList';
import { ExecutionPanel } from '../features/execution/components/ExecutionPanel';
import { StatusReportHistoryPanel } from '../features/execution/components/StatusReportHistoryPanel';
import { useStatusReports } from '../features/execution/hooks/useStatusReports';
import { PageLayout } from '../components/PageLayout';
import { SapIntegrationSection } from '../features/execution/components/SapIntegrationSection';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const RAG_COLOR: Record<string, string> = { GREEN: 'teal', AMBER: 'orange', RED: 'red' };
const RAG_LABEL: Record<string, string> = { GREEN: 'Green', AMBER: 'Amber', RED: 'Red' };

function RagBadge({ rag }: { rag: string }) {
  return <Badge color={RAG_COLOR[rag] ?? 'gray'}>{RAG_LABEL[rag] ?? rag}</Badge>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Text size="sm">{value ?? '—'}</Text>
    </Stack>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const { data: project, isLoading } = useProject(id ?? null);
  const { mutate: updateStage, isPending: isUpdatingStage } = useUpdateCurrentStage(id ?? '');
  const [planDirty, setPlanDirty] = useState(false);
  const [closureConfirmOpen, setClosureConfirmOpen] = useState(false);
  const [pendingClosureComment, setPendingClosureComment] = useState<string | undefined>();

  const ACTIVE_STATUSES = ['IN_EXECUTION', 'ASSUMED_COMPLETED'];
  const isActive = ACTIVE_STATUSES.includes(project?.status ?? '');
  const { data: statusReports = [] } = useStatusReports(isActive ? (id ?? null) : null);

  if (isLoading) {
    return (
      <Group justify="center" py={80}>
        <Loader />
      </Group>
    );
  }

  if (!project) {
    return (
      <Stack p="md" gap="sm">
        <Anchor component={Link} to="/projects" size="sm">← Back to Projects</Anchor>
        <Text c="dimmed">Project not found.</Text>
      </Stack>
    );
  }

  const isPpmOrAdmin = user?.roles.includes(Role.PortfolioManager) || user?.roles.includes(Role.Admin);
  const isAssignedPm = !!user && user.id === project.assignedPmId;
  const canEditPlan = !!user && (
    user.id === project.assignedPmId ||
    user.roles.includes(Role.PortfolioManager) ||
    user.roles.includes(Role.Admin)
  ) && !['PENDING_APPROVAL', 'PREPARE_FOR_CLOSURE', 'COMPLETED', 'CANCELLED'].includes(project.status);
  const isClosureActor = !!user && (
    user.id === project.assignedPmId ||
    (project.isSmallProject && user.id === project.demandManagerId) ||
    user.roles.includes(Role.PortfolioManager) ||
    user.roles.includes(Role.Admin)
  );

  const showCharter = ['DRAFT', 'PENDING_APPROVAL', 'IN_EXECUTION', 'PREPARE_FOR_CLOSURE', 'COMPLETED'].includes(project.status);
  const showClosure = ['PREPARE_FOR_CLOSURE', 'COMPLETED'].includes(project.status);

  const availableTabs = [
    'overview',
    ...(showCharter ? ['charter'] : []),
    'financials',
    'plan',
    ...(showClosure ? ['closure'] : []),
  ];
  const requestedTab = searchParams.get('tab') ?? 'overview';
  const activeTab = availableTabs.includes(requestedTab) ? requestedTab : 'overview';
  const setTab = (v: string | null) => { if (v) setSearchParams({ tab: v }); };

  return (
    <PageLayout>
      {/* Header — on canvas */}
      <Group gap="xs" mb="xs">
        <ActionIcon variant="subtle" component={Link} to="/projects" aria-label="Back to Projects">
          <IconArrowLeft size={18} />
        </ActionIcon>
        <Anchor component={Link} to="/projects" size="sm" c="dimmed">Projects</Anchor>
        <Text size="sm" c="dimmed">/</Text>
        <Text size="sm" fw={500}>{project.title}</Text>
      </Group>

      <Stack gap={4} mb="sm">
        <Text size="sm" c="dimmed">#{project.publicId}</Text>
        <Group gap="xs" align="center">
          <Title order={1}>{project.title}</Title>
          <DemandTypeIndicator type={project.demandType} />
          <CopyLinkButton />
        </Group>
      </Stack>

      <ProjectStatusStepper status={project.status} />

      {project.status !== 'CANCELLED' && (
        <Group mt="xs">
          <ProjectStatusBadge status={project.status} size="md" />
        </Group>
      )}

      {project.status === 'COMPLETED' && (
        <Alert color="gray" title="This project is completed" mt="sm" icon={null}>
          This project has been formally closed. All fields are read-only.
        </Alert>
      )}
      {project.status === 'PENDING_APPROVAL' && isPpmOrAdmin && (
        <Box mt="sm"><CharterApprovalPanel project={project} /></Box>
      )}
      {project.status === 'PREPARE_FOR_CLOSURE' && isPpmOrAdmin && (
        <Box mt="sm"><ClosureReviewPanel project={project} /></Box>
      )}

      <Modal
        opened={closureConfirmOpen}
        onClose={() => setClosureConfirmOpen(false)}
        title="Initiate Project Closure"
        centered
      >
        <Text size="sm" mb="md">
          This moves the project into <b>Prepare for Closure</b> and sends it to the Portfolio
          Manager for review. You won&apos;t be able to change the stage afterwards. Continue?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setClosureConfirmOpen(false)}>No</Button>
          <Button
            color="orange"
            loading={isUpdatingStage}
            onClick={() =>
              updateStage({ stage: 'Closure', comment: pendingClosureComment }, { onSuccess: () => { setClosureConfirmOpen(false); setPendingClosureComment(undefined); } })
            }
          >
            Yes, initiate closure
          </Button>
        </Group>
      </Modal>

      {/* Tabs — on canvas */}
      <Tabs value={activeTab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          {showCharter && <Tabs.Tab value="charter">Charter</Tabs.Tab>}
          <Tabs.Tab value="financials">Financials</Tabs.Tab>
          <Tabs.Tab value="plan" rightSection={planDirty ? <DirtyDot /> : undefined}>Plan</Tabs.Tab>
          {showClosure && <Tabs.Tab value="closure">Closure</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="overview" pt="lg">
          <Flex gap="xl" align="flex-start">
            <Card withBorder shadow="sm" radius="lg" p="xl" style={{ flex: 1, maxWidth: 800 }}>
              <Stack gap="md">
                {project.description && <Text size="sm" c="dimmed">{project.description}</Text>}

                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={500}>Source Demand</Text>
                  {project.demandId ? (
                    <Anchor component={Link} to={`/demands/${project.demandId}`} size="sm">
                      Source Demand #{project.publicId}
                    </Anchor>
                  ) : (
                    <Text size="sm" c="dimmed">No linked demand (imported project)</Text>
                  )}
                </Stack>

                <SimpleGrid cols={2} spacing="sm">
                  <Field label="Start Date" value={fmtDate(project.startDate)} />
                  <Field label="End Date" value={fmtDate(project.endDate)} />
                </SimpleGrid>
                {project.projectType && <Field label="Project Type" value={project.projectType} />}
                {project.investmentApproval && <Field label="Investment Approval" value={project.investmentApproval} />}

                {project.status === 'COMPLETED' && project.currentStage && (
                  <Field label="Final stage" value={project.currentStage} />
                )}

                {(project.status === 'IN_EXECUTION' || project.status === 'ASSUMED_COMPLETED') && (
                  <>
                    <Divider label="Status Reports" labelPosition="left" />
                    <Group gap="xs" wrap="wrap" align="center">
                      {project.overallRag ? (
                        <RagBadge rag={project.overallRag} />
                      ) : (
                        <Text size="sm" c="dimmed">Not Reported</Text>
                      )}
                      {isAssignedPm && (
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => navigate(`/projects/${project.id}/status-report`)}
                        >
                          Submit Status Report
                        </Button>
                      )}
                    </Group>
                    <StatusReportHistoryPanel reports={statusReports} />
                  </>
                )}

                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={500}>Project History</Text>
                  <ProjectHistoryList projectId={project.id} />
                </Stack>
              </Stack>
            </Card>
            {project.status === 'IN_EXECUTION' && (
              <ExecutionPanel
                currentStage={project.currentStage}
                isUpdating={isUpdatingStage}
                onStageChange={(stage, comment) => updateStage({ stage, comment })}
                onInitiateClosure={(comment) => { setPendingClosureComment(comment); setClosureConfirmOpen(true); }}
              />
            )}
          </Flex>
        </Tabs.Panel>

        {showCharter && (
          <Tabs.Panel value="charter" pt="lg">
            <Card withBorder shadow="sm" radius="lg" p="xl" maw={800}>
              <CharterForm
                project={project}
                isEditable={
                  project.status === 'IN_EXECUTION'
                    ? (isPpmOrAdmin || isAssignedPm)
                    : (project.status === 'DRAFT' && isAssignedPm)
                }
              />
            </Card>
          </Tabs.Panel>
        )}

        <Tabs.Panel value="financials" pt="lg">
          <FinancialPlanSection
            projectId={project.id}
            startDate={project.startDate}
            endDate={project.endDate}
            isEditable={
              ['DRAFT', 'IN_EXECUTION'].includes(project.status) &&
              project.assignedPmId === user?.id
            }
          />
          <SapIntegrationSection
            projectId={project.id}
            opexInternalOrder={project.opexInternalOrder ?? null}
            capexInternalOrder={project.capexInternalOrder ?? null}
            canEdit={!!(user?.roles.includes(Role.Admin) || user?.roles.includes(Role.BusinessController))}
          />
        </Tabs.Panel>

        <Tabs.Panel value="plan" pt="lg" keepMounted>
          <PlanBoard projectId={project.id} canEdit={canEditPlan} onDirtyChange={setPlanDirty} />
        </Tabs.Panel>

        {showClosure && (
          <Tabs.Panel value="closure" pt="lg">
            <Card withBorder shadow="sm" radius="lg" p="xl">
              <ClosureForm
                project={project}
                isActor={project.status === 'PREPARE_FOR_CLOSURE' ? isClosureActor : false}
              />
            </Card>
          </Tabs.Panel>
        )}
      </Tabs>
    </PageLayout>
  );
}

function DirtyDot() {
  return <Box style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--mantine-color-stadaRed-6)' }} />;
}
