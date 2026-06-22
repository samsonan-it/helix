import { useState } from 'react';
import {
  Table, Button, Skeleton, Alert, Stack, Group, Text,
  TextInput, MultiSelect, Pagination, Tooltip, ActionIcon, CopyButton,
} from '@mantine/core';
import { ListTableCard } from '../../../components/ListTableCard';
import { PageHeader } from '../../../components/PageHeader';
import { PageLayout } from '../../../components/PageLayout';
import { DateInput } from '@mantine/dates';
import { IconCopy, IconCheck, IconHistory } from '@tabler/icons-react';
import { AuditLogRow } from '@helix/shared';
import { useAdminAuditLogs } from '../hooks/useAdminAuditLogs';

const PAGE_SIZE = 50;

const KNOWN_EVENT_TYPES = [
  'AREA_ACTIVATED', 'AREA_CREATED', 'AREA_DEACTIVATED', 'AREA_UPDATED',
  'BC_APPROVED', 'BC_REJECTED', 'BC_REROUTED_TO_REQUESTER',
  'COST_CENTRE_ACTIVATED', 'COST_CENTRE_CREATED', 'COST_CENTRE_DEACTIVATED', 'COST_CENTRE_UPDATED',
  'COUNTRY_ACTIVATED', 'COUNTRY_CREATED', 'COUNTRY_DEACTIVATED', 'COUNTRY_UPDATED',
  'DEMAND_PM_APPROVED', 'DEMAND_PM_REJECTED', 'DEMAND_POSTPONED', 'DEMAND_REJECTED',
  'DEMAND_REROUTED', 'DEMAND_RESUMED', 'DEMAND_SUBMITTED', 'DEMAND_TYPE_SWITCHED',
  'DM_ACCEPTED_TO_BC', 'DM_DATES_UPDATED',
  'DRAFT_CREATED', 'DRAFT_DELETED', 'DRAFT_UPDATED',
  'FINANCIAL_PLAN_UPDATED',
  'FLAG_TOGGLED',
  'GL_ACCOUNT_ACTIVATED', 'GL_ACCOUNT_CREATED', 'GL_ACCOUNT_DEACTIVATED', 'GL_ACCOUNT_UPDATED',
  'LEGAL_ENTITY_ACTIVATED', 'LEGAL_ENTITY_CREATED', 'LEGAL_ENTITY_DEACTIVATED', 'LEGAL_ENTITY_UPDATED',
  'PROJECT_ASSUMED_COMPLETED', 'PROJECT_CREATED',
  'ROLE_ASSIGNED',
  'SP_DM_ACCEPTED', 'SP_DM_ACCEPTED_AND_ESTIMATED', 'SP_ESTIMATE_SUBMITTED',
  'SP_OFFER_ACCEPTED', 'SP_OFFER_REWORKED',
  'USER_CREATED', 'USER_STATUS_CHANGED',
  'create', 'update',
];

const KNOWN_ENTITY_TYPES = [
  'Area', 'CostCentre', 'Country', 'Demand', 'FeatureFlag',
  'FinancialPlan', 'GlAccount', 'LegalEntity', 'SystemConfig', 'User',
];

function formatChanges(row: AuditLogRow): string {
  const before = row.before ? JSON.stringify(row.before) : '—';
  const after  = row.after  ? JSON.stringify(row.after)  : '—';
  const combined = `${before} → ${after}`;
  return combined.length > 80 ? combined.slice(0, 80) + '...' : combined;
}

export function AuditLogAdminPage(): JSX.Element {
  const [entityIdInput, setEntityIdInput]   = useState('');
  const [eventTypesInput, setEventTypesInput] = useState<string[]>([]);
  const [entityTypeInput, setEntityTypeInput] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate]     = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{
    entityId?: string; eventTypes?: string[]; entityTypes?: string[]; from?: string; to?: string;
  }>({});
  const [page, setPage] = useState(1);

  const filters = {
    ...activeFilters,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data: result, isPending, isError, refetch } = useAdminAuditLogs(filters);

  function handleApply() {
    setPage(1);
    setActiveFilters({
      entityId:    entityIdInput.trim() || undefined,
      eventTypes:  eventTypesInput.length ? eventTypesInput : undefined,
      entityTypes: entityTypeInput.length ? entityTypeInput : undefined,
      from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
      to:   toDate   ? `${toDate}T23:59:59.999Z`   : undefined,
    });
  }

  function handleClear() {
    setEntityIdInput('');
    setEventTypesInput([]);
    setEntityTypeInput([]);
    setFromDate(null);
    setToDate(null);
    setPage(1);
    setActiveFilters({});
  }

  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 0;

  return (
    <PageLayout>
      <Stack gap="md">
      <PageHeader title="Audit Log" icon={<IconHistory size={22} />} />

      <Group align="flex-end" wrap="wrap">
        <TextInput
          label="Entity ID"
          placeholder="e.g. clxyz..."
          value={entityIdInput}
          onChange={(e) => setEntityIdInput(e.currentTarget.value)}
        />
        <MultiSelect
          label="Entity Type"
          placeholder="All types"
          data={KNOWN_ENTITY_TYPES}
          value={entityTypeInput}
          onChange={setEntityTypeInput}
          clearable
          searchable
          w={180}
        />
        <MultiSelect
          label="Event Type"
          placeholder="All events"
          data={KNOWN_EVENT_TYPES}
          value={eventTypesInput}
          onChange={setEventTypesInput}
          clearable
          searchable
          w={240}
        />
        <DateInput
          label="From"
          value={fromDate}
          onChange={setFromDate}
          valueFormat="YYYY-MM-DD"
          clearable
        />
        <DateInput
          label="To"
          value={toDate}
          onChange={setToDate}
          valueFormat="YYYY-MM-DD"
          clearable
        />
        <Button color="stadaRed" onClick={handleApply}>Apply Filters</Button>
        <Button variant="subtle" onClick={handleClear}>Clear</Button>
      </Group>

      {isPending && (
        <Stack gap="xs">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} radius="sm" />
          ))}
        </Stack>
      )}

      {isError && (
        <Alert color="stadaRed" title="Failed to load audit log">
          <Button variant="subtle" size="compact-sm" onClick={() => void refetch()}>Retry</Button>
        </Alert>
      )}

      {result && (
        <>
          <Text size="sm" c="dimmed">{result.total} entries found</Text>
          <ListTableCard>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Timestamp</Table.Th>
                <Table.Th>Actor</Table.Th>
                <Table.Th>Event Type</Table.Th>
                <Table.Th>Entity Type</Table.Th>
                <Table.Th>Entity ID</Table.Th>
                <Table.Th>Changes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.data.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text size="sm">{new Date(row.changedAt).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    {row.actorEmail ? (
                      <Tooltip label={row.actorEmail} withArrow>
                        <Text size="sm" style={{ cursor: 'default' }}>{row.actorName}</Text>
                      </Tooltip>
                    ) : (
                      <Text size="sm">{row.actorName}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.eventType}</Text>
                  </Table.Td>
                  <Table.Td>{row.entityType}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label={row.entityId} withArrow>
                        <Text size="sm">{row.entityId.length > 8 ? `${row.entityId.slice(0, 8)}…` : row.entityId}</Text>
                      </Tooltip>
                      <CopyButton value={row.entityId} timeout={1500}>
                        {({ copied, copy }) => (
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color={copied ? 'teal' : 'gray'}
                            onClick={copy}
                            aria-label="Copy entity ID"
                          >
                            {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                          </ActionIcon>
                        )}
                      </CopyButton>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={`${JSON.stringify(row.before)} → ${JSON.stringify(row.after)}`}>
                      <Text size="xs" c="dimmed">{formatChanges(row)}</Text>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </ListTableCard>

          {totalPages > 1 && (
            <Pagination total={totalPages} value={page} onChange={setPage} />
          )}
        </>
      )}
      </Stack>
    </PageLayout>
  );
}
