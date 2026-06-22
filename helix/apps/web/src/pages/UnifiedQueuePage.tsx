import { ActionIcon, Alert, Badge, Box, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconChevronUp, IconInbox, IconSelector } from '@tabler/icons-react';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { IconArrowLeft, IconX } from '@tabler/icons-react';
import { Role } from '@helix/types';
import { type DemandResponse, type UnifiedQueueItem } from '@helix/shared';
import { DemandStatusBadge } from '../components/DemandStatusBadge';
import { ListTableCard } from '../components/ListTableCard';
import { PageHeader } from '../components/PageHeader';
import { PageLayout } from '../components/PageLayout';
import { DemandTypeIndicator } from '../components/DemandTypeIndicator';
import { EmptyQueueState } from '../components/EmptyQueueState';
import { FilterPresetBar, type PresetConfig } from '../components/FilterPresetBar';
import { useAuthStore } from '../stores/auth.store';
import { useUnifiedQueue } from '../features/workflow/hooks/useUnifiedQueue';
import { getDemand } from '../features/workflow/api/workflow.api';
import { DmReviewPanel } from '../features/workflow/components/DmReviewPanel';
import { BcReviewPanel } from '../features/workflow/components/BcReviewPanel';
import { PmReviewPanel } from '../features/workflow/components/PmReviewPanel';
import { DrReviewPanel } from '../features/workflow/components/DrReviewPanel';
import { queryKeys } from '../lib/queryKeys';

const ROLE_BADGE_LABEL: Record<string, string> = {
  DemandManager:      'As DM',
  BusinessController: 'As BC',
  PortfolioManager:   'As PM',
  DemandRequester:    'As Requester',
};

const ALL_PRESETS: PresetConfig[] = [
  { value: 'ALL',     label: 'All' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'ON_HOLD', label: 'On Hold' },
];

const COLLAPSE_AT = 1024;
const PANEL_WIDTH = 920;

type RequiredRole = 'DemandManager' | 'BusinessController' | 'PortfolioManager' | 'DemandRequester';

function formatReceived(statusChangedAt: string | null): string {
  if (!statusChangedAt) return '—';
  return new Date(statusChangedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ActionPanel({
  demand,
  requiredRole,
  userName,
  onActionComplete,
}: {
  demand: DemandResponse;
  requiredRole: RequiredRole;
  userName: string;
  onActionComplete: () => void;
}) {
  if (requiredRole === 'DemandManager')
    return <DmReviewPanel demand={demand} dmName={userName} onActionComplete={onActionComplete} />;
  if (requiredRole === 'BusinessController')
    return <BcReviewPanel demand={demand} bcName={userName} onActionComplete={onActionComplete} />;
  if (requiredRole === 'PortfolioManager')
    return <PmReviewPanel demand={demand} pmName={userName} onActionComplete={onActionComplete} />;
  if (requiredRole === 'DemandRequester')
    return <DrReviewPanel demand={demand} onActionComplete={onActionComplete} />;
  return null;
}

export function UnifiedQueuePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const demandId = searchParams.get('demandId');

  const [preset, setPreset] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<UnifiedQueueItem>>({
    columnAccessor: 'statusChangedAt',
    direction: 'desc',
  });

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : COLLAPSE_AT + 1,
  );
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const collapsed = windowWidth < COLLAPSE_AT;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const stalledOnly = preset === 'OVERDUE';
  const onHoldOnly  = preset === 'ON_HOLD';
  const { data: items = [], isLoading, isError } = useUnifiedQueue({
    stalledOnly,
    onHoldOnly,
    search: debouncedSearch || undefined,
  });

  const { data: selectedDemand } = useQuery({
    queryKey: demandId ? queryKeys.demands.detail(demandId) : ['demands', '__skip__'],
    queryFn: () => getDemand(demandId!),
    enabled: !!demandId,
  });

  const handleSelectDemand = (id: string) => setSearchParams({ demandId: id });
  const handleBack = () => setSearchParams({});

  const isDm = user?.roles.includes(Role.DemandManager)      ?? false;
  const isBc = user?.roles.includes(Role.BusinessController) ?? false;
  const isPm = user?.roles.includes(Role.PortfolioManager)   ?? false;
  const isDr = user?.roles.includes(Role.DemandRequester)    ?? false;
  const isMultiRole = [isDm, isBc, isPm, isDr].filter(Boolean).length > 1;

  const displayItems = items;

  const sortedItems = useMemo(() => {
    const data = [...displayItems];
    const { columnAccessor, direction } = sortStatus;
    data.sort((a, b) => {
      const av = a[columnAccessor as keyof UnifiedQueueItem];
      const bv = b[columnAccessor as keyof UnifiedQueueItem];
      // Treat null/undefined as '' for strings, -Infinity for numbers
      const normalize = (v: unknown) => {
        if (v == null) return typeof av === 'number' || typeof bv === 'number' ? -Infinity : '';
        return v;
      };
      const na = normalize(av);
      const nb = normalize(bv);
      const cmp = na < nb ? -1 : na > nb ? 1 : 0;
      return direction === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [displayItems, sortStatus]);

  const sortedItemsRef = useRef(sortedItems);
  sortedItemsRef.current = sortedItems;
  const demandIdRef = useRef(demandId);
  demandIdRef.current = demandId;

  useEffect(() => {
    if (demandIdRef.current && !sortedItemsRef.current.some((i) => i.id === demandIdRef.current)) setSearchParams({});
  }, [sortedItems]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleBack(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedRoleRef = useRef<RequiredRole | undefined>(undefined);

  const handleActionComplete = useCallback(() => {
    const list = sortedItemsRef.current;
    const cur  = demandIdRef.current;
    const idx  = list.findIndex((d) => d.id === cur);
    const next = list[idx + 1];
    if (next) setSearchParams({ demandId: next.id });
    else      setSearchParams({});
  }, [setSearchParams]);

  const presets = isDm ? ALL_PRESETS : ALL_PRESETS.filter((p) => p.value !== 'ON_HOLD');

  const isFiltered = !!debouncedSearch || preset !== 'ALL';

  const clearFilters = () => { setSearch(''); setPreset('ALL'); setSearchParams({}); };

  const listPanel = (
    <PageLayout fullWidth>
      <Stack gap="sm">
      <PageHeader title={t('nav.actionQueue')} icon={<IconInbox size={22} />} />
      <Group align="center" wrap="wrap" gap="sm">
        <TextInput
          size="sm"
          placeholder="Search by title or demand # (e.g. 42)"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={400}
          style={{ flex: '1 1 240px', maxWidth: 400 }}
        />
        <FilterPresetBar
          presets={presets}
          defaultValue={preset}
          onChange={(v) => { setPreset(v); setSearchParams({}); }}
          label="Status"
        />
      </Group>
      {isError ? (
        <Alert color="stadaRed" title="Failed to load queue">
          Could not load your action queue. Please refresh the page or contact support.
        </Alert>
      ) : displayItems.length === 0 && !isLoading ? (
        isFiltered ? (
          <EmptyQueueState type="filtered" onClearFilter={clearFilters} />
        ) : (
          <EmptyQueueState type="empty" />
        )
      ) : (
        <ListTableCard>
          <DataTable<UnifiedQueueItem>
            records={sortedItems}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            sortIcons={{
              sorted: <IconChevronUp size={14} color="var(--mantine-color-red-6)" />,
              unsorted: <IconSelector size={14} color="var(--mantine-color-dimmed)" />,
            }}
            columns={[
              {
                accessor: 'publicId', title: '#', width: 60, sortable: true,
                render: ({ publicId }: UnifiedQueueItem) => <Text size="sm" c="dimmed">{publicId}</Text>,
              },
              {
                accessor: 'title', title: 'Title', sortable: true,
                render: ({ title }: UnifiedQueueItem) => <Text size="sm" fw={1000}>{title}</Text>,
              },
              {
                accessor: 'isSmallProject', title: 'Type', sortable: true,
                render: ({ isSmallProject }: UnifiedQueueItem) => (
                  <DemandTypeIndicator type={isSmallProject ? 'SP' : 'P'} />
                ),
              },
              {
                accessor: 'statusChangedAt', title: 'Received', sortable: true,
                render: ({ statusChangedAt, stalledDays }: UnifiedQueueItem) => (
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{formatReceived(statusChangedAt)}</Text>
                    {stalledDays > 0 && (
                      <Badge size="xs" color={stalledDays > 7 ? 'red' : stalledDays > 3 ? 'orange' : 'gray'} variant="light">
                        {stalledDays}d
                      </Badge>
                    )}
                  </Group>
                ),
              },
              {
                accessor: 'status' as keyof UnifiedQueueItem,
                title: 'Status',
                sortable: true,
                render: ({ status }: UnifiedQueueItem) => <DemandStatusBadge status={status} size="sm" />,
              },
              ...(isMultiRole ? [{
                accessor: 'requiredRole' as keyof UnifiedQueueItem,
                title: 'Role',
                sortable: true,
                render: ({ requiredRole }: UnifiedQueueItem) => (
                  <Badge variant="outline" color="violet" size="sm">
                    {ROLE_BADGE_LABEL[requiredRole] ?? requiredRole}
                  </Badge>
                ),
              }] : []),
              { accessor: 'requesterName', title: 'Requester', sortable: true },
              {
                accessor: 'assigneeName', title: 'Assignee', sortable: true,
                render: ({ assigneeName }: UnifiedQueueItem) => assigneeName ?? '—',
              },
            ]}
            onRowClick={({ record }) => {
              if (record.id === demandId) handleBack();
              else handleSelectDemand(record.id);
            }}
            highlightOnHover
            rowStyle={({ id }) => id === demandId ? { backgroundColor: 'var(--mantine-color-stadaBlue-0)' } : undefined}
          />
        </ListTableCard>
      )}
      </Stack>
    </PageLayout>
  );

  const itemDerivedRole = displayItems.find((i) => i.id === demandId)?.requiredRole as RequiredRole | undefined;
  if (itemDerivedRole) selectedRoleRef.current = itemDerivedRole;
  const selectedRole = itemDerivedRole ?? (demandId ? selectedRoleRef.current : undefined);

  const detailPanel = selectedDemand && selectedRole ? (
    <ActionPanel
      key={demandId}
      demand={selectedDemand}
      requiredRole={selectedRole}
      userName={user?.name ?? ''}
      onActionComplete={handleActionComplete}
    />
  ) : (
    <Box p="xl">
      <EmptyQueueState type="empty" message="Select a demand from the queue to review it." />
    </Box>
  );

  // Narrow screen: detail replaces list full-screen
  if (collapsed) {
    return (
      <Box style={{ height: '100%' }}>
        {demandId ? (
          <Box style={{ height: '100%' }}>
            <Group mb="sm">
              <ActionIcon variant="subtle" onClick={handleBack} aria-label="Back to list">
                <IconArrowLeft size={18} />
              </ActionIcon>
            </Group>
            {detailPanel}
          </Box>
        ) : listPanel}
      </Box>
    );
  }

  // Wide screen: full-width table + overlay panel (GitLab style — table columns unchanged)
  return (
    <Box style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <Box style={{ width: '100%', height: '100%', overflow: 'auto' }}>
        {listPanel}
      </Box>
      <Box style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: demandId ? PANEL_WIDTH : 0,
        overflow: 'hidden',
        borderLeft: demandId ? '1px solid var(--mantine-color-gray-3)' : 'none',
        boxShadow: demandId ? '-4px 0 16px rgba(0,0,0,0.10)' : 'none',
        transition: 'width 220ms ease',
        zIndex: 200,
        backgroundColor: 'var(--mantine-color-body)',
      }}>
        <Box style={{ width: PANEL_WIDTH, height: '100%', overflow: 'auto' }}>
          {demandId && (
            <Group justify="flex-end" px="sm" pt="sm">
              <ActionIcon variant="subtle" onClick={handleBack} aria-label="Close panel">
                <IconX size={16} />
              </ActionIcon>
            </Group>
          )}
          {detailPanel}
        </Box>
      </Box>
    </Box>
  );
}
