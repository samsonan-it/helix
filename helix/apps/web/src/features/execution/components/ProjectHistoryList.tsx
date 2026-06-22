import { Text, Table } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { queryKeys } from '../../../lib/queryKeys';
import { getProjectHistory } from '../api/execution.api';

const HIDDEN_EVENTS = new Set(['PROJECT_CHARTER_UPDATED', 'PROJECT_PLAN_UPDATED']);

const STAGE_EVENTS = new Set(['PROJECT_STAGE_UPDATED', 'PROJECT_CLOSURE_INITIATED']);

function getStageTransition(entry: { eventType: string; before?: unknown; after?: unknown }): string | null {
  if (!STAGE_EVENTS.has(entry.eventType)) return null;
  const before = (entry.before as { currentStage?: string } | null)?.currentStage;
  const after  = (entry.after  as { currentStage?: string } | null)?.currentStage;
  if (!after) return null;
  return before ? `${before} → ${after}` : after;
}

function getComment(entry: { after?: unknown }): string | null {
  return (entry.after as { comment?: string } | null)?.comment ?? null;
}

function getEventLabel(entry: { eventType: string; before?: unknown; after?: unknown }): string {
  const transition = getStageTransition(entry);
  if (entry.eventType === 'PROJECT_STAGE_UPDATED' && transition) return `Execution: ${transition}`;
  if (entry.eventType === 'PROJECT_CLOSURE_INITIATED') return 'Closure Initiated';
  return EVENT_LABELS[entry.eventType] ?? entry.eventType;
}

const EVENT_LABELS: Record<string, string> = {
  PROJECT_CREATED:            'Project Created',
  PROJECT_CHARTER_SUBMITTED:  'Charter Submitted for Approval',
  CHARTER_APPROVED:           'Charter Approved',
  CHARTER_RETURNED:           'Charter Returned for Rework',
  PROJECT_CLOSURE_SUBMITTED:  'Closure Submitted',
  CLOSURE_ACCEPTED:           'Closure Accepted',
  CLOSURE_RETURNED:           'Closure Returned for Rework',
  PROJECT_ASSUMED_COMPLETED:  'Marked as Assumed Completed',
};

interface Props {
  projectId: string;
}

export function ProjectHistoryList({ projectId }: Props) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.projects.history(projectId),
    queryFn: () => getProjectHistory(projectId),
  });

  if (isLoading) return <Text size="sm" c="dimmed">Loading history…</Text>;

  const visible = entries.filter(e => !HIDDEN_EVENTS.has(e.eventType));

  if (visible.length === 0) return <Text size="sm" c="dimmed">No history yet.</Text>;

  return (
    <Table role="log" aria-label="Project history" withRowBorders fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Event</Table.Th>
          <Table.Th>Actor</Table.Th>
          <Table.Th>Date</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {visible.map(entry => {
          const comment = getComment(entry);
          return (
            <Table.Tr key={entry.id}>
              <Table.Td>
                {getEventLabel(entry)}
                {comment && (
                  <Text size="xs" c="dimmed" mt={2}>{comment}</Text>
                )}
              </Table.Td>
              <Table.Td>{entry.actorName}</Table.Td>
              <Table.Td c="dimmed">{dayjs(entry.changedAt).format('DD MMM YYYY HH:mm')}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
