import React from 'react';
import { Anchor, Badge, Box, Button, Divider, Group, Paper, Skeleton, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconHome } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Role } from '@helix/types';
import { DemandStatus, type DemandResponse } from '@helix/shared';
import { useAuthStore } from '../stores/auth.store';
import { queryKeys } from '../lib/queryKeys';
import { getMyDemands, getDashboardStats } from '../features/workflow/api/workflow.api';
import { getProjectList } from '../features/execution/api/execution.api';
import { useUnifiedQueue } from '../features/workflow/hooks/useUnifiedQueue';
import { useClosureQueue } from '../features/execution/hooks/useClosureQueue';
import { useCharterQueue } from '../features/execution/hooks/useCharterQueue';
import { DemandStatusBadge } from '../components/DemandStatusBadge';
import { EmptyQueueState } from '../components/EmptyQueueState';
import { PageHeader } from '../components/PageHeader';
import { PageLayout } from '../components/PageLayout';
import { ProjectStatusBadge } from '../features/execution/components/ProjectStatusBadge';

type HomeLayout = 'power-user' | 'occasional' | 'executive';

function deriveHomeLayout(roles: string[]): HomeLayout {
  if (roles.includes(Role.SECMember) || roles.includes(Role.Admin)) return 'executive';
  if (
    roles.includes(Role.DemandManager) ||
    roles.includes(Role.PortfolioManager) ||
    roles.includes(Role.BusinessController)
  ) return 'power-user';
  return 'occasional';
}

const DM_STALL_THRESHOLD_DAYS = 7;

const INACTIVE_STATUSES = new Set([DemandStatus.DRAFT, DemandStatus.COMPLETED, DemandStatus.CANCELLED]);


function formatEuroCents(cents: number): string {
  const eur = Math.round(cents / 100);
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}M`;
  if (eur >= 1_000) return `€${(eur / 1_000).toFixed(1)}K`;
  return `€${eur}`;
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function formatUpdatedAt(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accentColor,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  accentColor: string;
}) {
  return (
    <Paper
      withBorder
      radius="sm"
      p="sm"
      style={{ borderTop: `2px solid var(--mantine-color-${accentColor}-5)` }}
    >
      <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>{label}</Text>
      <Text size="xl" fw={700} c={`${accentColor}.6`} lh={1}>{value}</Text>
      <Text size="xs" c="dimmed" mt={3}>{sub}</Text>
    </Paper>
  );
}

function AgingBadge({ days }: { days: number }) {
  const color = days > DM_STALL_THRESHOLD_DAYS ? 'red' : days >= 3 ? 'yellow' : 'gray';
  return <Badge color={color} variant="light" size="sm">{days}d</Badge>;
}

function OfferReviewBanner({ demand, onAction }: { demand: DemandResponse; onAction: () => void }) {
  const days = daysAgo(demand.updatedAt);
  const comment = demand.dmCommentary
    ? `"${demand.dmCommentary.slice(0, 120)}${demand.dmCommentary.length > 120 ? '…' : ''}"`
    : null;
  return (
    <Paper
      p="sm"
      mb="sm"
      style={{
        background: 'var(--mantine-color-blue-0)',
        border: '1px solid var(--mantine-color-blue-2)',
        borderLeftColor: 'var(--mantine-color-blue-5)',
        borderLeftWidth: '3px',
        borderRadius: 'var(--mantine-radius-sm)',
      }}
    >
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Text size="lg" style={{ lineHeight: 1.5, flexShrink: 0 }} aria-hidden="true">📋</Text>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600}>{demand.title} — SP offer awaiting your review</Text>
          {comment && <Text size="xs" c="blue.8">{comment}</Text>}
          <Text size="xs" c="blue.6">
            Received {days === 0 ? 'today' : `${days}d ago`}
            {demand.costCentreId ? ` · ${demand.costCentreId}` : ''}
          </Text>
        </Stack>
        <Button size="xs" color="blue" style={{ flexShrink: 0 }} onClick={onAction}>
          Review Offer →
        </Button>
      </Group>
    </Paper>
  );
}

function AttentionBanner({ demand, onAction }: { demand: DemandResponse; onAction: () => void }) {
  const days = daysAgo(demand.updatedAt);
  const comment = demand.dmCommentary
    ? `"${demand.dmCommentary.slice(0, 120)}${demand.dmCommentary.length > 120 ? '…' : ''}"`
    : null;
  return (
    <Paper
      p="sm"
      mb="sm"
      style={{
        background: 'var(--mantine-color-orange-0)',
        border: '1px solid var(--mantine-color-orange-2)',
        borderLeftColor: 'var(--mantine-color-orange-5)',
        borderLeftWidth: '3px',
        borderRadius: 'var(--mantine-radius-sm)',
      }}
    >
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Text size="lg" style={{ lineHeight: 1.5, flexShrink: 0 }}>↩</Text>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600}>{demand.title} — returned for rework</Text>
          {comment && <Text size="xs" c="orange.8">{comment}</Text>}
          <Text size="xs" c="orange.6">
            Returned {days === 0 ? 'today' : `${days}d ago`}
            {demand.costCentreId ? ` · ${demand.costCentreId}` : ''}
          </Text>
        </Stack>
        <Button size="xs" color="orange" style={{ flexShrink: 0 }} onClick={onAction}>
          Edit &amp; Resubmit →
        </Button>
      </Group>
    </Paper>
  );
}

const ROLE_BADGE_LABEL: Record<string, string> = {
  DemandManager:      'As DM',
  BusinessController: 'As BC',
  PortfolioManager:   'As PM',
};

interface DemandPanelRow {
  id: string;
  title: string;
  meta: string;
  status: DemandStatus;
  stalledDays?: number;
  requiredRole?: string;
  onClick: () => void;
}

function DemandPanelRowItem({ row }: { row: DemandPanelRow }) {
  const [hovered, setHovered] = React.useState(false);
  const isStalled = row.stalledDays !== undefined && row.stalledDays > DM_STALL_THRESHOLD_DAYS;
  return (
    <Group
      px="sm"
      py={8}
      justify="space-between"
      wrap="nowrap"
      onClick={row.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        backgroundColor: hovered ? 'var(--mantine-color-gray-0)' : undefined,
        borderLeft: isStalled
          ? '2px solid var(--mantine-color-red-5)'
          : '2px solid transparent',
      }}
    >
      <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
        <Text
          size="sm"
          fw={500}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {row.title}
        </Text>
        <Text size="xs" c="dimmed">{row.meta}</Text>
      </Stack>
      <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
        {row.requiredRole && (
          <Badge variant="outline" color="violet" size="xs">
            {ROLE_BADGE_LABEL[row.requiredRole] ?? row.requiredRole}
          </Badge>
        )}
        <DemandStatusBadge status={row.status} size="sm" />
        {row.stalledDays !== undefined && <AgingBadge days={row.stalledDays} />}
      </Group>
    </Group>
  );
}

function DemandPanel({
  title,
  rows,
  headerBadge,
  footerTo,
  footerLabel,
  isLoading,
}: {
  title: string;
  rows: DemandPanelRow[];
  headerBadge?: React.ReactNode;
  footerTo?: string;
  footerLabel?: string;
  isLoading?: boolean;
}) {
  const navigate = useNavigate();
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
      <Group
        px="sm"
        py={8}
        justify="space-between"
        style={{
          background: 'var(--mantine-color-gray-0)',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        }}
      >
        <Group gap="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">{title}</Text>
          {headerBadge}
        </Group>
        {footerTo && (
          <Anchor
            size="xs"
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.preventDefault(); navigate(footerTo); }}
          >
            View all →
          </Anchor>
        )}
      </Group>

      {isLoading && (
        <Stack gap={0} p="sm">
          {[0, 1, 2].map((i) => <Skeleton key={i} height={44} radius="xs" mb={6} />)}
        </Stack>
      )}

      {isEmpty && <EmptyQueueState type="empty" />}

      {!isLoading && !isEmpty && rows.map((row, i) => (
        <React.Fragment key={row.id}>
          <DemandPanelRowItem row={row} />
          {i < rows.length - 1 && <Divider />}
        </React.Fragment>
      ))}

      {footerTo && footerLabel && !isEmpty && !isLoading && (
        <>
          <Divider />
          <Group justify="center" py={8}>
            <Anchor
              size="xs"
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.preventDefault(); navigate(footerTo); }}
            >
              {footerLabel}
            </Anchor>
          </Group>
        </>
      )}
    </Paper>
  );
}

// ── Dashboard variants ────────────────────────────────────────────────────────

function PowerUserDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDm  = user?.roles.includes(Role.DemandManager)      ?? false;
  const isBc  = user?.roles.includes(Role.BusinessController) ?? false;
  const isPm        = user?.roles.includes(Role.PortfolioManager)   ?? false;
  const isAdmin     = user?.roles.includes(Role.Admin)              ?? false;
  const isPpmOrAdmin = isPm || isAdmin;
  const isRequester = user?.roles.includes(Role.DemandRequester) ?? false;

  const actionableRoleCount = [isDm, isBc, isPm].filter(Boolean).length;
  const isMultiRole = user !== null && actionableRoleCount > 1;

  const { data: unifiedItems = [] } = useUnifiedQueue();
  const { data: closureQueue = [] } = useClosureQueue({ enabled: isPm });
  const { data: charterQueue = [] } = useCharterQueue({ enabled: isPpmOrAdmin });

  const { data: myDemands = [] } = useQuery({
    queryKey: queryKeys.demands.myList({ limit: 5 }),
    queryFn: () => getMyDemands({ limit: 5 }),
  });

  const allItems = unifiedItems;

  const queueLabel = isMultiRole
    ? 'Action Queue'
    : isDm ? 'DM Queue' : isBc ? 'BC Queue' : 'PM Queue';

  const overdueStalled = allItems.filter((i) => i.stalledDays > DM_STALL_THRESHOLD_DAYS).length;
  const ownDemands = myDemands.filter((d) => d.originatorId === user?.id);
  const offerReviewDemands = ownDemands.filter((d) => d.status === DemandStatus.SP_OFFER_REVIEW);
  const reroutedDemands = ownDemands.filter((d) => d.status === DemandStatus.REROUTED);
  const activeMyDemands = ownDemands.filter(
    (d) => !INACTIVE_STATUSES.has(d.status) && d.status !== DemandStatus.SP_OFFER_REVIEW,
  );

  const sorted = [...allItems].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const queueRows: DemandPanelRow[] = sorted.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    meta: [`#${item.publicId}`, `Received at: ${formatUpdatedAt(item.updatedAt)}`].join(' · '),
    status: item.status,
    stalledDays: item.stalledDays,
    requiredRole: isMultiRole ? item.requiredRole : undefined,
    onClick: () => navigate(`/demands/unified-queue?demandId=${item.id}`),
  }));

  const myDemandRows: DemandPanelRow[] = activeMyDemands.map((d) => ({
    id: d.id,
    title: d.title,
    meta: [`#${d.publicId}`, formatUpdatedAt(d.updatedAt)].join(' · '),
    status: d.status,
    onClick: () => navigate(`/demands/${d.id}`),
  }));


  return (
    <PageLayout>
    <Stack>
      <PageHeader
        title="My Dashboard"
        icon={<IconHome size={22} />}
        actions={isRequester ? (
          <Button color="stadaRed" radius="xl" onClick={() => navigate('/demands/new')}>
            New Demand
          </Button>
        ) : undefined}
      />

      <SimpleGrid cols={3} spacing="xs" mb="xl">
        <StatCard
          label={queueLabel}
          value={allItems.length}
          sub="awaiting your review"
          accentColor="blue"
        />
        <StatCard
          label="Stalled >7d"
          value={overdueStalled}
          sub={overdueStalled === 0 ? 'queue healthy' : 'need urgent action'}
          accentColor="orange"
        />
        <StatCard
          label="My Demands"
          value={activeMyDemands.length}
          sub={activeMyDemands.length === 1 ? '1 active demand' : `${activeMyDemands.length} active demands`}
          accentColor="green"
        />
      </SimpleGrid>

      {offerReviewDemands.map((d) => (
        <OfferReviewBanner key={d.id} demand={d} onAction={() => navigate(`/demands/${d.id}`)} />
      ))}

      {reroutedDemands.map((d) => (
        <AttentionBanner key={d.id} demand={d} onAction={() => navigate(`/demands/${d.id}`)} />
      ))}

      <Box mb="md">
      <DemandPanel
        title={queueLabel}
        rows={queueRows}
        headerBadge={
          overdueStalled > 0
            ? <Badge color="stadaRed" size="xs">{overdueStalled} stalled</Badge>
            : undefined
        }
        footerTo="/demands/unified-queue"
        footerLabel={`View all demands in ${queueLabel} →`}
      />
      </Box>

      {isPm && closureQueue.length > 0 && (
        <Box mb="md">
          <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
            <Group
              px="sm"
              py={8}
              justify="space-between"
              style={{ background: 'var(--mantine-color-gray-0)', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">Closure Review Queue</Text>
              <Badge color="yellow" size="xs">{closureQueue.length}</Badge>
            </Group>
            {closureQueue.map((p, i) => (
              <React.Fragment key={p.id}>
                <Group
                  px="sm"
                  py={8}
                  justify="space-between"
                  wrap="nowrap"
                  onClick={() => navigate(`/projects?id=${p.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {[
                        p.assignedPmName ?? '—',
                        p.closureSubmittedAt
                          ? `Submitted: ${new Date(p.closureSubmittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : 'Submitted: —',
                      ].join(' · ')}
                    </Text>
                  </Stack>
                  <ProjectStatusBadge status={p.status} size="sm" />
                </Group>
                {i < closureQueue.length - 1 && <Divider />}
              </React.Fragment>
            ))}
            <Divider />
            <Group justify="center" py={8}>
              <Anchor size="xs" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); navigate('/projects'); }}>
                View all projects →
              </Anchor>
            </Group>
          </Paper>
        </Box>
      )}

      {isPpmOrAdmin && charterQueue.length > 0 && (
        <Box mb="md">
          <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
            <Group
              px="sm"
              py={8}
              justify="space-between"
              style={{ background: 'var(--mantine-color-gray-0)', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">Charter Approval Queue</Text>
              <Badge color="blue" size="xs">{charterQueue.length}</Badge>
            </Group>
            {charterQueue.map((p, i) => (
              <React.Fragment key={p.id}>
                <Group
                  px="sm"
                  py={8}
                  justify="space-between"
                  wrap="nowrap"
                  onClick={() => navigate(`/projects?id=${p.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {[
                        p.assignedPmName ?? '—',
                        p.charterSubmittedAt
                          ? `Submitted: ${new Date(p.charterSubmittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : 'Submitted: —',
                      ].join(' · ')}
                    </Text>
                  </Stack>
                  <ProjectStatusBadge status={p.status} size="sm" />
                </Group>
                {i < charterQueue.length - 1 && <Divider />}
              </React.Fragment>
            ))}
            <Divider />
            <Group justify="center" py={8}>
              <Anchor size="xs" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); navigate('/projects'); }}>
                View all projects →
              </Anchor>
            </Group>
          </Paper>
        </Box>
      )}

      <DemandPanel
        title="My Demands"
        rows={myDemandRows}
        footerTo="/demands"
        footerLabel="View all my demands →"
      />
    </Stack>
    </PageLayout>
  );
}

function OccasionalDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isRequester = user?.roles.includes(Role.DemandRequester) ?? false;
  const { data: demands = [], isLoading } = useQuery({
    queryKey: queryKeys.demands.myList({ limit: 5 }),
    queryFn: () => getMyDemands({ limit: 5 }),
  });
  const { data: queueItems = [] } = useUnifiedQueue();
  const { data: projectList } = useQuery({
    queryKey: queryKeys.projects.list({}),
    queryFn: () => getProjectList(),
  });
  const charterPendingProjects = (projectList?.data ?? []).filter(
    (p) => p.status === 'DRAFT' || p.status === 'PENDING_APPROVAL',
  );

  const offerReviewDemands = demands.filter((d) => d.status === DemandStatus.SP_OFFER_REVIEW);
  const reroutedDemands = demands.filter((d) => d.status === DemandStatus.REROUTED);
  const activeRows: DemandPanelRow[] = demands
    .filter((d) => !INACTIVE_STATUSES.has(d.status) && d.status !== DemandStatus.SP_OFFER_REVIEW)
    .map((d) => ({
      id: d.id,
      title: d.title,
      meta: [`#${d.publicId}`, formatUpdatedAt(d.updatedAt)].join(' · '),
      status: d.status,
      onClick: () => navigate(`/demands/${d.id}`),
    }));

  const queueRows: DemandPanelRow[] = queueItems.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    meta: [`#${item.publicId}`, formatUpdatedAt(item.updatedAt)].join(' · '),
    status: item.status,
    stalledDays: item.stalledDays,
    onClick: () => navigate(`/demands/unified-queue?demandId=${item.id}`),
  }));

  return (
    <PageLayout>
    <Stack>
      <PageHeader
        title="My Dashboard"
        icon={<IconHome size={22} />}
        actions={isRequester ? (
          <Button color="stadaRed" radius="xl" onClick={() => navigate('/demands/new')}>
            Submit a New Demand
          </Button>
        ) : undefined}
      />

      {offerReviewDemands.map((d) => (
        <OfferReviewBanner key={d.id} demand={d} onAction={() => navigate(`/demands/${d.id}`)} />
      ))}

      {reroutedDemands.map((d) => (
        <AttentionBanner key={d.id} demand={d} onAction={() => navigate(`/demands/${d.id}`)} />
      ))}

      {queueRows.length > 0 && (
        <Box mb="md">
          <DemandPanel
            title="Action Queue"
            rows={queueRows}
            footerTo="/demands/unified-queue"
            footerLabel="View all demands in Action Queue →"
          />
        </Box>
      )}

      <DemandPanel
        title="My Demands"
        rows={activeRows}
        isLoading={isLoading}
        footerTo="/demands"
        footerLabel="View all my demands →"
      />

      {charterPendingProjects.length > 0 && (
        <Box mb="md">
          <Title order={5} mb="xs">My Projects — Charter</Title>
          <Stack gap="xs">
            {charterPendingProjects.map((p) => (
              <Paper key={p.id} withBorder p="sm" radius="sm">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text size="sm" fw={500}>{p.title}</Text>
                    <ProjectStatusBadge status={p.status} />
                  </Stack>
                  <Anchor
                    component="button"
                    size="sm"
                    onClick={() => navigate(`/projects?id=${p.id}`)}
                  >
                    {p.status === 'DRAFT' ? 'Complete Charter →' : 'Charter Submitted →'}
                  </Anchor>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
    </PageLayout>
  );
}

function ExecutiveDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.demands.dashboardStats(),
    queryFn: getDashboardStats,
  });

  const stalledRows: DemandPanelRow[] = (stats?.stalledDemands ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    meta: d.costCentreId ?? '—',
    status: d.status,
    onClick: () => navigate(`/demands/${d.id}`),
  }));

  return (
    <PageLayout>
    <Stack>
      <PageHeader title="Executive Dashboard" icon={<IconHome size={22} />} />

      {isLoading && (
        <SimpleGrid cols={3} spacing="xs" mb="xl">
          {[0, 1, 2].map((i) => <Skeleton key={i} height={80} radius="sm" />)}
        </SimpleGrid>
      )}

      {stats && (
        <>
          <SimpleGrid cols={3} spacing="xs" mb="xl">
            <StatCard
              label="Active Demands"
              value={stats.totalActiveDemands}
              sub="across all cost centres"
              accentColor="blue"
            />
            <StatCard
              label="Budget Committed"
              value={`${formatEuroCents(stats.budgetCommittedCents)} / ${formatEuroCents(stats.budgetPlannedCents)}`}
              sub="committed vs. planned"
              accentColor="green"
            />
            <StatCard
              label="Pending Decision"
              value={stats.demandsPendingDecision}
              sub="awaiting approval"
              accentColor="orange"
            />
          </SimpleGrid>

          <DemandPanel
            title="Stalled Demands"
            rows={stalledRows}
            headerBadge={<Badge color="orange" size="xs">{stats.stalledDemands.length}</Badge>}
          />
        </>
      )}
    </Stack>
    </PageLayout>
  );
}

export function DashboardPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const layout = deriveHomeLayout(user?.roles ?? []);

  if (layout === 'power-user') return <PowerUserDashboard />;
  if (layout === 'executive') return <ExecutiveDashboard />;
  return <OccasionalDashboard />;
}
