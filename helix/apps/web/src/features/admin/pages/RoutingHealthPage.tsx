import {
  Table,
  Badge,
  Skeleton,
  Alert,
  Button,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { ListTableCard } from '../../../components/ListTableCard';
import { PageHeader } from '../../../components/PageHeader';
import { PageLayout } from '../../../components/PageLayout';
import { IconCheck, IconHeartbeat } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useRoutingHealth } from '../hooks/useRoutingHealth';

export function RoutingHealthPage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useRoutingHealth();

  const areaRows = data?.areaHealth ?? [];
  const ccRows = data?.costCentreHealth ?? [];

  const dmGapCount = areaRows.filter((r) => r.hasDmGap).length;
  const bcGapCount = areaRows.filter((r) => r.hasBcGap).length;
  const pmGapCount = ccRows.filter((r) => r.hasPmGap).length;

  return (
    <PageLayout>
      <Stack gap="xl">
      <PageHeader title="Routing Health" icon={<IconHeartbeat size={22} />} />

      {isPending && (
        <Stack gap="xs">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} radius="sm" />
          ))}
        </Stack>
      )}

      {isError && (
        <Alert color="stadaRed" title="Failed to load routing health">
          <Button variant="subtle" size="compact-sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      )}

      {data && (
        <>
          {/* ── Area Coverage ─────────────────────────────────────── */}
          <Stack gap="sm">
            <Title order={3} fz="md">Area Coverage — Demand Managers &amp; Business Controllers</Title>

            {areaRows.length > 0 && dmGapCount === 0 && bcGapCount === 0 && (
              <Alert color="green" icon={<IconCheck size={16} />} title="All areas are correctly configured" />
            )}
            {dmGapCount > 0 && (
              <Alert color="stadaRed" title={`${dmGapCount} area${dmGapCount > 1 ? 's' : ''} without a Demand Manager`} />
            )}
            {bcGapCount > 0 && (
              <Alert color="orange" title={`${bcGapCount} area${bcGapCount > 1 ? 's' : ''} without a Business Controller`} />
            )}

            <ListTableCard>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Area Name</Table.Th>
                  <Table.Th>Demand Manager</Table.Th>
                  <Table.Th>Business Controller</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {areaRows.map((row) => (
                  <Table.Tr
                    key={row.areaId}
                    style={(row.hasDmGap || row.hasBcGap) ? { cursor: 'pointer' } : undefined}
                    tabIndex={(row.hasDmGap || row.hasBcGap) ? 0 : undefined}
                    role={(row.hasDmGap || row.hasBcGap) ? 'button' : undefined}
                    aria-label={(row.hasDmGap || row.hasBcGap) ? `Fix gaps for ${row.areaName}` : undefined}
                    onClick={
                      (row.hasDmGap || row.hasBcGap)
                        ? () => navigate(`/admin/users?areaId=${row.areaId}`)
                        : undefined
                    }
                    onKeyDown={
                      (row.hasDmGap || row.hasBcGap)
                        ? (e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/admin/users?areaId=${row.areaId}`); }
                        : undefined
                    }
                  >
                    <Table.Td>{row.areaCode}</Table.Td>
                    <Table.Td>{row.areaName}</Table.Td>
                    <Table.Td>
                      {row.demandManager
                        ? `${row.demandManager.name} (${row.demandManager.email})`
                        : <Text c="dimmed" size="sm">⚠️ Not configured</Text>}
                    </Table.Td>
                    <Table.Td>
                      {row.businessController
                        ? `${row.businessController.name} (${row.businessController.email})`
                        : <Text c="dimmed" size="sm">⚠️ Not configured</Text>}
                    </Table.Td>
                    <Table.Td>
                      {!row.hasDmGap && !row.hasBcGap ? (
                        <ThemeIcon color="green" variant="light" size="sm">
                          <IconCheck size={14} />
                        </ThemeIcon>
                      ) : (
                        <Stack gap={4}>
                          {row.hasDmGap && <Badge color="stadaRed" size="sm">No DM</Badge>}
                          {row.hasBcGap && <Badge color="orange" size="sm">No BC</Badge>}
                        </Stack>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            </ListTableCard>
          </Stack>

          {/* ── Cost Centre Coverage (PM) ──────────────────────────── */}
          <Stack gap="sm">
            <Title order={3} fz="md">Cost Centre Coverage — Portfolio Managers</Title>

            {ccRows.length > 0 && pmGapCount === 0 && (
              <Alert color="green" icon={<IconCheck size={16} />} title="All cost centres have a Portfolio Manager" />
            )}
            {pmGapCount > 0 && (
              <Alert color="orange" title={`${pmGapCount} cost centre${pmGapCount > 1 ? 's' : ''} without a Portfolio Manager`} />
            )}

            <ListTableCard>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Portfolio Manager</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ccRows.map((row) => (
                  <Table.Tr
                    key={row.costCentreId}
                    style={row.hasPmGap ? { cursor: 'pointer' } : undefined}
                    tabIndex={row.hasPmGap ? 0 : undefined}
                    role={row.hasPmGap ? 'button' : undefined}
                    aria-label={row.hasPmGap ? `Fix PM gap for ${row.name}` : undefined}
                    onClick={row.hasPmGap ? () => navigate(`/admin/users?costCentreId=${row.costCentreId}`) : undefined}
                    onKeyDown={row.hasPmGap ? (e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/admin/users?costCentreId=${row.costCentreId}`); } : undefined}
                  >
                    <Table.Td>{row.code}</Table.Td>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>
                      {row.portfolioManagers.length > 0
                        ? row.portfolioManagers.map((pm) => pm.name).join(', ')
                        : <Text c="dimmed" size="sm">—</Text>}
                    </Table.Td>
                    <Table.Td>
                      {!row.hasPmGap ? (
                        <ThemeIcon color="green" variant="light" size="sm">
                          <IconCheck size={14} />
                        </ThemeIcon>
                      ) : (
                        <Badge color="stadaRed" size="sm">No PM</Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            </ListTableCard>
          </Stack>
        </>
      )}
      </Stack>
    </PageLayout>
  );
}
