import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  useMantineTheme,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendarPlus, IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react';
import type { ProjectPlanItem, ReplaceProjectPlanRequest } from '../api/execution.api';
import { useProjectPlan } from '../hooks/useProjectPlan';
import { useReplaceProjectPlan } from '../hooks/useReplaceProjectPlan';
import { PlanGantt, GANTT_HEADER_HEIGHT } from './PlanGantt';

const RAIL_WIDTH = 340;

interface LocalItem {
  tempId: string;
  name: string;
  type: 'PHASE' | 'MILESTONE';
  startDate: string | null; // ISO 8601
  endDate: string | null;   // ISO 8601, null for MILESTONE
}

interface Props {
  projectId: string;
  canEdit: boolean;
  /** Lets the host (tab page) surface an unsaved-changes indicator. */
  onDirtyChange?: (dirty: boolean) => void;
}

function toLocalItem(it: ProjectPlanItem): LocalItem {
  return { tempId: it.id, name: it.name, type: it.type, startDate: it.startDate, endDate: it.endDate };
}

function serialize(items: LocalItem[]): string {
  return JSON.stringify(
    items.map((i) => ({
      name: i.name.trim(),
      type: i.type,
      startDate: i.startDate,
      endDate: i.type === 'PHASE' ? i.endDate : null,
    })),
  );
}

function isoToDateStr(iso: string | null): Date | null {
  if (!iso) return null;
  // Parse the UTC date part and create a local-midnight Date so the picker shows the right calendar day
  return new Date(iso.slice(0, 10) + 'T00:00:00');
}
function dateStrToIso(s: string | Date | null): string | null {
  if (!s) return null;
  const d = s instanceof Date ? s : new Date(s + 'T00:00:00');
  // Use local date components → UTC midnight, avoiding off-by-one in UTC-negative timezones
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}T00:00:00.000Z`;
}
function rowError(it: LocalItem): string | null {
  if (!it.name.trim()) return 'Name is required';
  if (!it.startDate) return 'Start date is required';
  if (it.type === 'PHASE') {
    if (!it.endDate) return 'End date is required for phases';
    if (new Date(it.endDate) < new Date(it.startDate)) return 'End date must be ≥ start date';
  }
  return null;
}

export function PlanBoard({ projectId, canEdit, onDirtyChange }: Props) {
  const theme = useMantineTheme();
  const { data, isLoading } = useProjectPlan(projectId);
  const { mutate: replacePlan, isPending, isError } = useReplaceProjectPlan(projectId);

  const serverItems = useMemo(() => data?.items ?? [], [data]);

  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [serverKey, setServerKey] = useState<string | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Sync local copy from server on first load, and on external refresh when clean.
  useEffect(() => {
    const key = serialize(serverItems.map(toLocalItem));
    const dirtyNow = serverKey !== null && serialize(localItems) !== serverKey;
    if (serverKey === null || (key !== serverKey && !dirtyNow)) {
      setLocalItems(serverItems.map(toLocalItem));
      setServerKey(key);
    }
  }, [serverItems]);

  const dirty = serverKey !== null && serialize(localItems) !== serverKey;
  const hasErrors = localItems.some((i) => rowError(i) !== null);
  const isEmpty = localItems.length === 0;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  // Guard against navigating away with unsaved edits.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function update(tempId: string, patch: Partial<LocalItem>) {
    setLocalItems((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, ...patch } : i)));
  }
  function remove(tempId: string) {
    setLocalItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }
  function moveItem(tempId: string, direction: 'up' | 'down') {
    setLocalItems((prev) => {
      const idx = prev.findIndex((i) => i.tempId === tempId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }
  function addItem(type: 'PHASE' | 'MILESTONE' = 'PHASE') {
    const tempId = `new-${Date.now()}-${Math.random()}`;
    setLocalItems((prev) => [...prev, { tempId, name: '', type, startDate: null, endDate: null }]);
    setLastAddedId(tempId);
  }
  function discard() {
    setLocalItems(serverItems.map(toLocalItem));
  }
  function save() {
    if (hasErrors || isEmpty) return;
    const dto: ReplaceProjectPlanRequest = {
      items: localItems.map((i) => ({
        name: i.name.trim(),
        type: i.type,
        startDate: i.startDate ?? '',
        endDate: i.type === 'PHASE' ? i.endDate : null,
      })),
    };
    replacePlan(dto, { onSuccess: () => setServerKey(serialize(localItems)) });
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  // Empty state — no plan yet.
  if (isEmpty && !dirty) {
    if (!canEdit) {
      return <Text size="sm" c="dimmed">No project plan defined yet.</Text>;
    }
    return (
      <Stack align="center" py={64} gap="sm">
        <Text fw={600}>No project plan yet</Text>
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          Lay out the phases and milestones for this project to see them on a timeline.
        </Text>
        <Button leftSection={<IconCalendarPlus size={16} />} onClick={() => addItem('PHASE')}>
          Add first phase
        </Button>
      </Stack>
    );
  }

  const planItems: ProjectPlanItem[] = localItems
    .filter((i) => i.startDate)
    .map((i, idx) => ({
      id: i.tempId,
      name: i.name.trim() || 'Untitled',
      type: i.type,
      startDate: i.startDate!,
      endDate: i.type === 'PHASE' ? i.endDate : null,
      displayOrder: idx,
    }));

  return (
    <>
      {canEdit ? (
        <Box style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minHeight: 0 }}>
          {/* Left rail — edit mode */}
          <Box style={{ width: RAIL_WIDTH, flexShrink: 0 }}>
            <Text fw={600} size="sm" mb="xs" style={{ height: GANTT_HEADER_HEIGHT - 8, display: 'flex', alignItems: 'flex-end' }}>
              Phases &amp; Milestones
            </Text>
            <Stack gap="xs">
              {localItems.map((it) => {
                const err = rowError(it);
                const isFirst = localItems[0].tempId === it.tempId;
                const isLast = localItems[localItems.length - 1].tempId === it.tempId;
                return (
                  <Paper key={it.tempId} withBorder p="xs" radius="sm">
                    <Group wrap="nowrap" gap="xs" mb={6}>
                      <Group gap={2}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          disabled={isFirst}
                          aria-label={isFirst ? 'Move up (already first)' : 'Move up'}
                          onClick={() => moveItem(it.tempId, 'up')}
                        >
                          <IconChevronUp size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          disabled={isLast}
                          aria-label={isLast ? 'Move down (already last)' : 'Move down'}
                          onClick={() => moveItem(it.tempId, 'down')}
                        >
                          <IconChevronDown size={14} />
                        </ActionIcon>
                      </Group>
                      <SegmentedControl
                        size="xs"
                        data={['PHASE', 'MILESTONE']}
                        value={it.type}
                        onChange={(v) =>
                          update(it.tempId, {
                            type: v as 'PHASE' | 'MILESTONE',
                            endDate: v === 'MILESTONE' ? null : it.endDate,
                          })
                        }
                      />
                      <ActionIcon variant="subtle" color="stadaRed" ml="auto" onClick={() => remove(it.tempId)} aria-label="Delete item">
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                    <TextInput
                      size="xs"
                      placeholder="Name"
                      value={it.name}
                      onChange={(e) => update(it.tempId, { name: e.currentTarget.value })}
                      autoFocus={it.tempId === lastAddedId}
                      mb={6}
                    />
                    <Group gap="xs" grow wrap="nowrap">
                      <DatePickerInput
                        size="xs"
                        placeholder="Start"
                        valueFormat="DD MMM YYYY"
                        value={isoToDateStr(it.startDate)}
                        onChange={(v) => update(it.tempId, { startDate: dateStrToIso(v) })}
                      />
                      {it.type === 'PHASE' && (
                        <DatePickerInput
                          size="xs"
                          placeholder="End"
                          valueFormat="DD MMM YYYY"
                          value={isoToDateStr(it.endDate)}
                          onChange={(v) => update(it.tempId, { endDate: dateStrToIso(v) })}
                        />
                      )}
                    </Group>
                    {err && <Text c="red" size="xs" mt={4}>{err}</Text>}
                  </Paper>
                );
              })}
              <Button
                variant="light"
                size="xs"
                leftSection={<IconCalendarPlus size={14} />}
                onClick={() => addItem('PHASE')}
              >
                Add phase / milestone
              </Button>
            </Stack>
          </Box>

          {/* Gantt — edit mode, draggable bars */}
          {planItems.length > 0 ? (
            <PlanGantt
              items={planItems}
              canEdit
              onDateChange={({ id, start, end }) => {
                setLocalItems((prev) =>
                  prev.map((it) =>
                    it.tempId === id
                      ? {
                          ...it,
                          startDate: dateStrToIso(start),
                          endDate: it.type === 'PHASE' ? dateStrToIso(end) : null,
                        }
                      : it,
                  ),
                );
              }}
            />
          ) : (
            <Box style={{ flex: 1 }}>
              <Text size="sm" c="dimmed" pt={GANTT_HEADER_HEIGHT}>
                Add a start date to see items on the timeline.
              </Text>
            </Box>
          )}
        </Box>
      ) : (
        /* Read-only mode — no left rail; Gantt shows sticky name+dates columns */
        <PlanGantt items={planItems} canEdit={false} />
      )}

      {/* Sticky unsaved-changes bar */}
      {canEdit && dirty && (
        <Paper
          withBorder
          p="sm"
          radius="sm"
          mt="md"
          style={{ position: 'sticky', bottom: 0, zIndex: 2 }}
        >
          <Group justify="space-between">
            <Group gap="xs">
              <Box style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.colors.stadaRed[6] }} />
              <Text size="sm">Unsaved changes</Text>
              {isError && <Text size="sm" c="red">— save failed, try again</Text>}
            </Group>
            <Group gap="xs">
              <Button variant="default" size="sm" onClick={discard} disabled={isPending}>
                Discard
              </Button>
              <Button size="sm" onClick={save} loading={isPending} disabled={hasErrors || isEmpty}>
                Save plan
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      {/* Confirm navigation away while dirty */}
      <Modal
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Discard unsaved changes?"
        centered
      >
        <Text size="sm" mb="lg">
          You have unsaved changes to the project plan. Leaving now will discard them.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => blocker.reset?.()}>Stay</Button>
          <Button color="stadaRed" onClick={() => { discard(); blocker.proceed?.(); }}>Discard &amp; leave</Button>
        </Group>
      </Modal>
    </>
  );
}
