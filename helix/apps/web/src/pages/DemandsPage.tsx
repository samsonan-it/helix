import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Anchor, Box, Button, Checkbox, Group, Modal, Skeleton, Stack, Table, Tabs, Text, TextInput, UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronUp, IconChevronDown, IconSelector, IconClipboardList } from '@tabler/icons-react';
import { DemandStatus } from '@helix/shared';
import type { DemandResponse } from '@helix/shared';
import { Role } from '@helix/types';
import { useAuthStore } from '../stores/auth.store';
import { queryKeys } from '../lib/queryKeys';
import { getMyDemands } from '../features/workflow/api/workflow.api';
import { useDeleteDemand } from '../features/intake/intake.queries';
import { DemandStatusBadge } from '../components/DemandStatusBadge';
import { DemandTypeIndicator } from '../components/DemandTypeIndicator';
import { EmptyQueueState } from '../components/EmptyQueueState';
import { ListTableCard } from '../components/ListTableCard';
import { PageHeader } from '../components/PageHeader';
import { PageLayout } from '../components/PageLayout';

const PAGE_SIZE = 10;
const FILTER_KEY = 'helix.myDemands.filter';

export type FilterCode = 'active' | 'all' | 'drafts' | 'closed';
const VALID_FILTERS: FilterCode[] = ['active', 'all', 'drafts', 'closed'];

const ACTIVE_EXCLUDED = [DemandStatus.DRAFT, DemandStatus.COMPLETED, DemandStatus.CANCELLED];
const CLOSED_STATUSES = [DemandStatus.COMPLETED, DemandStatus.CANCELLED];

export function applyFilter(demands: DemandResponse[], filter: FilterCode): DemandResponse[] {
  switch (filter) {
    case 'active':  return demands.filter(d => !ACTIVE_EXCLUDED.includes(d.status));
    case 'drafts':  return demands.filter(d => d.status === DemandStatus.DRAFT);
    case 'closed':  return demands.filter(d => CLOSED_STATUSES.includes(d.status));
    default:        return demands;
  }
}

function readStoredFilter(): FilterCode {
  const v = localStorage.getItem(FILTER_KEY);
  return VALID_FILTERS.includes(v as FilterCode) ? (v as FilterCode) : 'active';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type SortCol = 'title' | 'type' | 'status' | 'date';
type SortDir = 'asc' | 'desc';

function sortDemands(demands: DemandResponse[], col: SortCol | null, dir: SortDir): DemandResponse[] {
  if (!col) return demands;
  return [...demands].sort((a, b) => {
    let cmp = 0;
    if (col === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (col === 'type') {
      cmp = a.projectType.localeCompare(b.projectType);
    } else if (col === 'status') {
      const la = STATUS_SORT_ORDER[a.status] ?? 99;
      const lb = STATUS_SORT_ORDER[b.status] ?? 99;
      cmp = la - lb;
    } else if (col === 'date') {
      cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

// Logical workflow order so status sort is meaningful, not alphabetical
const STATUS_SORT_ORDER: Partial<Record<DemandStatus, number>> = {
  [DemandStatus.DRAFT]:        0,
  [DemandStatus.SUBMITTED]:       1,
  [DemandStatus.BC_REVIEW]:       2,
  [DemandStatus.SP_OFFER_REVIEW]: 2,
  [DemandStatus.IN_REVIEW]:       3,
  [DemandStatus.REROUTED]:     3,
  [DemandStatus.ON_HOLD]:      4,
  [DemandStatus.APPROVED]:     5,
  [DemandStatus.IN_EXECUTION]: 6,
  [DemandStatus.COMPLETED]:    7,
  [DemandStatus.REJECTED]:     8,
  [DemandStatus.CANCELLED]:    9,
};

const EMPTY_MESSAGES: Record<FilterCode, string> = {
  active:  "All your demands are closed or complete — nothing needs you right now.",
  all:     "You haven't submitted any demands yet.",
  drafts:  "No drafts saved. Start a demand whenever you're ready.",
  closed:  "No completed or cancelled demands yet.",
};

export function DemandsPage(): JSX.Element {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isRequester = user?.roles.includes(Role.DemandRequester) ?? false;

  const [filter, setFilter] = useState<FilterCode>(readStoredFilter);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sortCol, setSortCol] = useState<SortCol | null>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const deleteMutation = useDeleteDemand();

  const numericId = search.trim() && !isNaN(Number(search.trim())) && String(parseInt(search.trim(), 10)) === search.trim() && parseInt(search.trim(), 10) > 0
    ? parseInt(search.trim(), 10)
    : undefined;

  const { data: raw = [], isLoading } = useQuery({
    queryKey: queryKeys.demands.myList({ publicId: numericId }),
    queryFn: () => getMyDemands({ publicId: numericId }),
  });

  const myDemands = raw.filter(d => d.originatorId === user?.id);
  const titleFiltered = numericId !== undefined
    ? myDemands
    : (search.trim() ? myDemands.filter(d => d.title.toLowerCase().includes(search.trim().toLowerCase())) : myDemands);
  const filtered = sortDemands(applyFilter(titleFiltered, filter), sortCol, sortDir);
  const visible = filtered.slice(0, visibleCount);

  function handleFilterChange(value: string | null) {
    const next = VALID_FILTERS.includes(value as FilterCode) ? (value as FilterCode) : 'active';
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
    localStorage.setItem(FILTER_KEY, next);
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleRowSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleConfirmBulkDelete() {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map(id => deleteMutation.mutateAsync(id)));
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    setDeleteModalOpen(false);
    setIsBulkDeleting(false);
    if (failedIds.length > 0) {
      notifications.show({ color: 'red', message: 'Could not delete draft — please try again.' });
      setSelectedIds(new Set(failedIds));
    } else {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <PageLayout>
    <Stack gap="sm">
      <PageHeader
        title="My Demands"
        icon={<IconClipboardList size={22} />}
        actions={isRequester ? (
          <Button color="stadaRed" radius="xl" style={{ flexShrink: 0 }} onClick={() => navigate('/demands/new')}>
            Submit a New Demand
          </Button>
        ) : undefined}
      />

      <Tabs value={filter} onChange={handleFilterChange}>
        <Tabs.List>
          <Tabs.Tab value="active">Active</Tabs.Tab>
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="drafts">Drafts</Tabs.Tab>
          <Tabs.Tab value="closed">Closed</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <TextInput
        size="sm"
        placeholder="Search by title or demand # (e.g. 42)"
        value={search}
        onChange={(e) => { setSearch(e.currentTarget.value); setVisibleCount(PAGE_SIZE); }}
        maw={400}
      />

      {isLoading ? (
        <Stack gap={6}>
          <Skeleton height={44} radius="xs" />
          <Skeleton height={44} radius="xs" />
          <Skeleton height={44} radius="xs" />
        </Stack>
      ) : filtered.length === 0 ? (
        <Stack align="center" py="xl" gap="sm">
          {filter === 'active' ? (
            <EmptyQueueState type="empty" message={EMPTY_MESSAGES.active} />
          ) : (
            <Text c="dimmed" ta="center">{EMPTY_MESSAGES[filter]}</Text>
          )}
          {isRequester && filter !== 'closed' && (
            <Button
              variant={filter === 'active' ? 'outline' : 'filled'}
              color="stadaRed"
              radius="xl"
              onClick={() => navigate('/demands/new')}
            >
              Submit a New Demand
            </Button>
          )}
        </Stack>
      ) : (
        <Stack gap="xs">
          {filter === 'drafts' && (
            <Group justify="space-between">
              <Box>
                {selectionMode && selectedIds.size > 0 && (
                  <Button
                    variant="filled"
                    color="stadaRed"
                    size="sm"
                    onClick={() => setDeleteModalOpen(true)}
                  >
                    Delete selected
                  </Button>
                )}
              </Box>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  setSelectionMode(m => !m);
                  setSelectedIds(new Set());
                }}
              >
                {selectionMode ? 'Cancel' : 'Select'}
              </Button>
            </Group>
          )}

          <Modal
            opened={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            title={
              selectedIds.size === 1
                ? `Delete Draft — ${visible.find(d => selectedIds.has(d.id))?.title ?? ''}?`
                : `Delete ${selectedIds.size} Drafts?`
            }
            closeOnClickOutside={false}
          >
            <Text>This cannot be undone.</Text>
            <Group justify="space-between" mt="md">
              <Button variant="default" onClick={() => setDeleteModalOpen(false)} autoFocus>
                Cancel
              </Button>
              <Button
                color="stadaRed"
                loading={isBulkDeleting}
                onClick={handleConfirmBulkDelete}
              >
                Delete
              </Button>
            </Group>
          </Modal>

          <ListTableCard>
          <Table highlightOnHover style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              {filter === 'drafts' && selectionMode && <col style={{ width: '40px' }} />}
              <col style={{ width: '60px' }} />
              <col style={{ width: 'calc(70%)' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '185px' }} />
              <col style={{ width: '210px' }} />
            </colgroup>
            <Table.Thead>
              <Table.Tr>
                {filter === 'drafts' && selectionMode && <Table.Th />}
                <Table.Th style={{ color: 'var(--mantine-color-dimmed)', fontWeight: 600 }}>#</Table.Th>
                {(['title', 'type', 'date', 'status'] as SortCol[]).map((col, i) => {
                  const label = ['Title', 'Type', 'Last Updated', 'Status'][i];
                  const active = sortCol === col;
                  const Icon = active ? (sortDir === 'asc' ? IconChevronUp : IconChevronDown) : IconSelector;
                  return (
                    <Table.Th key={col}>
                      <UnstyledButton
                        onClick={() => handleSort(col)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 'inherit' }}
                      >
                        {label}
                        <Icon size={14} color={active ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-dimmed)'} />
                      </UnstyledButton>
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map(d => (
                <Table.Tr
                  key={d.id}
                  onClick={() => {
                    if (selectionMode && filter === 'drafts') {
                      toggleRowSelection(d.id);
                    } else {
                      navigate(`/demands/${d.id}`);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    borderLeft: d.status === DemandStatus.REROUTED
                      ? '2px solid var(--mantine-color-orange-5)'
                      : '2px solid transparent',
                  }}
                >
                  {filter === 'drafts' && selectionMode && (
                    <Table.Td onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleRowSelection(d.id)}
                      />
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Text size="sm" c="dimmed">{d.publicId}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{d.title}</Text>
                  </Table.Td>
                  <Table.Td>
                    <DemandTypeIndicator type={d.projectType as 'P' | 'SP'} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(d.updatedAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <DemandStatusBadge status={d.status} size="sm" />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          </ListTableCard>

          <Stack align="center" gap={4} mt="xs">
            <Text size="sm" c="dimmed">
              Showing {visible.length} of {filtered.length} demands
            </Text>
            {visible.length < filtered.length && (
              <Anchor component="button" size="sm" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                Show more
              </Anchor>
            )}
          </Stack>
        </Stack>
      )}
    </Stack>
    </PageLayout>
  );
}
