import { Text, Table } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { queryKeys } from '../../../lib/queryKeys';
import { getDemandHistory } from '../api/workflow.api';

const HIDDEN_EVENTS = new Set(['DRAFT_CREATED', 'DRAFT_UPDATED', 'DRAFT_DELETED', 'create', 'update']);

const EVENT_LABELS: Record<string, string> = {
  DEMAND_SUBMITTED:             'Submitted',
  DEMAND_ACCEPTED:              'Accepted by DM',
  DM_ACCEPTED_TO_BC:            'Forwarded to Business Controller',
  DEMAND_REROUTED:              'Returned for Rework',
  DEMAND_REJECTED:              'Rejected by DM',
  DEMAND_POSTPONED:             'Postponed',
  DEMAND_RESUMED:               'Resumed',
  BC_APPROVED:                  'Approved by Business Controller',
  BC_REJECTED:                  'Rejected by Business Controller',
  BC_REROUTED_TO_REQUESTER:     'Returned to Requester by BC',
  DEMAND_PM_APPROVED:           'Approved by PM',
  DEMAND_PM_REJECTED:           'Rejected by PM',
  PM_SENT_TO_REQUESTER:         'Sent Back to Requester by PM',
  PM_SENT_TO_DM:                'Sent Back to DM by PM',
  DEMAND_TYPE_SWITCHED:         'Type Switched to SP',
  SP_DM_ACCEPTED_AND_ESTIMATED: 'Accepted & Estimated by DM (SP)',
  SP_DM_ACCEPTED:               'Accepted by DM (SP)',
  SP_ESTIMATE_SUBMITTED:        'Estimate Submitted',
  SP_OFFER_ACCEPTED:            'Offer Accepted',
  SP_OFFER_REWORKED:            'Offer Returned for Rework',
  FINANCIAL_PLAN_UPDATED:       'Financial Plan Updated',
  DM_DATES_UPDATED:             'Delivery Dates Updated',
};

function extractCommentary(after: unknown): string | null {
  if (!after || typeof after !== 'object') return null;
  const obj = after as Record<string, unknown>;
  const value = obj['dmCommentary'] ?? obj['pmCommentary'] ?? obj['onHoldReason'];
  return typeof value === 'string' ? value : null;
}

interface Props {
  demandId: string;
}

export function DemandHistoryList({ demandId }: Props) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.demands.history(demandId),
    queryFn: () => getDemandHistory(demandId),
  });

  if (isLoading) return <Text size="sm" c="dimmed">Loading history…</Text>;

  const visible = entries.filter(e => !HIDDEN_EVENTS.has(e.eventType));

  if (visible.length === 0) return <Text size="sm" c="dimmed">No workflow history yet.</Text>;

  return (
    <Table role="log" aria-label="Demand history" withRowBorders fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Event</Table.Th>
          <Table.Th>Actor</Table.Th>
          <Table.Th>Commentary</Table.Th>
          <Table.Th>Date</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {visible.map(entry => {
          const commentary = extractCommentary(entry.after);
          return (
            <Table.Tr key={entry.id}>
              <Table.Td>{EVENT_LABELS[entry.eventType] ?? entry.eventType}</Table.Td>
              <Table.Td>{entry.actorName}</Table.Td>
              <Table.Td c="dimmed" style={{ fontStyle: commentary ? 'italic' : undefined }}>
                {commentary ?? ''}
              </Table.Td>
              <Table.Td c="dimmed">{dayjs(entry.changedAt).format('DD MMM YYYY HH:mm')}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
