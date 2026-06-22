import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Group,
  Popover,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { IconColumns3, IconLayoutGrid } from '@tabler/icons-react';
import { DataTable, type DataTableColumn } from 'mantine-datatable';
import { useTranslation } from 'react-i18next';
import { ListTableCard } from '../components/ListTableCard';
import { PageHeader } from '../components/PageHeader';
import { PageLayout } from '../components/PageLayout';
import { DemandStatus } from '@helix/shared';
import { DemandStatusBadge } from '../components/DemandStatusBadge';
import { EmptyQueueState } from '../components/EmptyQueueState';
import { FilterPresetBar, type PresetConfig } from '../components/FilterPresetBar';
import { useGetAreas, useGetPersons } from '../features/intake/intake.queries';
import { usePortfolioList } from '../features/portfolio/hooks/usePortfolioList';
import { type PortfolioFilters, type PortfolioItem } from '../features/portfolio/api/portfolio.api';

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

const PRESETS: PresetConfig[] = [
  { value: 'ACTIVE',           label: 'Active Portfolio' },
  { value: 'PENDING_APPROVAL', label: 'Pending My Approval' },
  { value: 'ON_HOLD',          label: 'On Hold' },
  { value: 'ALL',              label: 'All' },
];

const CURRENT_YEAR = new Date().getFullYear();
const MONTH_KEYS = Array.from({ length: 12 }, (_, i) =>
  `${CURRENT_YEAR}-${String(i + 1).padStart(2, '0')}`,
);
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Date(CURRENT_YEAR, i, 1).toLocaleString('en', { month: 'short' }),
);

const FIXED_COLUMNS = [
  'publicId',
  'title',
  'demandType',
  'projectType',
  'investmentApproval',
  'startDate',
  'endDate',
  'itProjectManager',
  'status',
  'eligibleForPpp',
  'demandPriority',
  'isInflight',
  'relevantYear',
  ...MONTH_KEYS,
  'forecastOpex',
  'totalCapex',
  'totalCosts',
];

const COLUMN_LABELS: Record<string, string> = {
  publicId:          '#',
  title:             'Name',
  demandType:        'Demand Type',
  projectType:       'Project Type',
  investmentApproval: 'Investment Approval',
  startDate:         'Schedule Start',
  endDate:           'Schedule Finish',
  itProjectManager:  'IT Project Manager',
  status:            'Status',
  eligibleForPpp:    'Eligible for PPP',
  demandPriority:    'Demand Priority',
  isInflight:        'Inflight',
  relevantYear:      'Relevant Year',
  forecastOpex:      'Forecast OPEX',
  totalCapex:        'Total CAPEX',
  totalCosts:        'Total Costs',
  ...Object.fromEntries(MONTH_KEYS.map((k, i) => [k, MONTH_LABELS[i]])),
};

const DEMAND_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'P', label: 'P' },
  { value: 'SP', label: 'SP' },
];

const CURRENT_YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: String(CURRENT_YEAR - 2 + i),
  label: String(CURRENT_YEAR - 2 + i),
}));
const YEAR_OPTIONS = [{ value: '', label: 'All Years' }, ...CURRENT_YEAR_OPTIONS];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...Object.values(DemandStatus)
    .filter((s) => s !== DemandStatus.DRAFT)
    .map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
];

export function PortfolioPage() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState('ACTIVE');
  const [year, setYear] = useState<number | undefined>(undefined);
  const [demandType, setDemandType] = useState<'P' | 'SP' | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [pmId, setPmId] = useState<string | undefined>(undefined);
  const [areaId, setAreaId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(FIXED_COLUMNS);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);

  const { data: areas = [] } = useGetAreas();
  const { data: persons = [] } = useGetPersons();

  const filters: PortfolioFilters = {
    preset,
    year,
    demandType,
    status,
    pmId,
    areaId,
    page,
    pageSize: 50,
  };

  const { data, isFetching, isError } = usePortfolioList(filters);

  const activeYear = year ?? CURRENT_YEAR;
  const activeMonthKeys = Array.from({ length: 12 }, (_, i) =>
    `${activeYear}-${String(i + 1).padStart(2, '0')}`,
  );

  const handleClearFilters = () => {
    setPreset('ACTIVE');
    setYear(undefined);
    setDemandType(undefined);
    setStatus(undefined);
    setPmId(undefined);
    setAreaId(undefined);
    setPage(1);
  };

  const handlePresetChange = (value: string) => {
    setPreset(value);
    setPage(1);
  };

  const columns: DataTableColumn<PortfolioItem>[] = FIXED_COLUMNS.filter((col) => visibleColumns.includes(col)).map((col) => {
    const monthIdx = MONTH_KEYS.indexOf(col);
    if (monthIdx !== -1) {
      const activeKey = activeMonthKeys[monthIdx];
      return {
        accessor: col,
        title: COLUMN_LABELS[col],
        width: 80,
        render: (row: PortfolioItem) => formatCents(row.monthlyOpex[activeKey] ?? 0),
      };
    }
    switch (col) {
      case 'publicId':
        return {
          accessor: 'publicId', title: '#', width: 60, sortable: false,
          render: (row: PortfolioItem) => <Text size="sm" c="dimmed">{row.publicId}</Text>,
        };
      case 'title':
        return {
          accessor: 'title', title: 'Name', width: 200,
          render: (row: PortfolioItem) => <Text size="sm" fw={600}>{row.title}</Text>,
        };
      case 'demandType':
        return { accessor: 'demandType', title: 'Demand Type', width: 110 };
      case 'projectType':
        return {
          accessor: 'projectType',
          title: 'Project Type',
          width: 110,
          render: (row: PortfolioItem) => row.projectType ?? '—',
        };
      case 'investmentApproval':
        return {
          accessor: 'investmentApproval',
          title: 'Investment Approval',
          width: 160,
          render: (row: PortfolioItem) => row.investmentApproval ?? '—',
        };
      case 'startDate':
        return {
          accessor: 'startDate',
          title: 'Schedule Start',
          width: 120,
          render: (row: PortfolioItem) =>
            row.startDate ? new Date(row.startDate).toLocaleDateString('en-DE') : '—',
        };
      case 'endDate':
        return {
          accessor: 'endDate',
          title: 'Schedule Finish',
          width: 120,
          render: (row: PortfolioItem) =>
            row.endDate ? new Date(row.endDate).toLocaleDateString('en-DE') : '—',
        };
      case 'itProjectManager':
        return {
          accessor: 'itProjectManager',
          title: 'IT Project Manager',
          width: 180,
          render: (row: PortfolioItem) => row.itProjectManager?.name ?? '—',
        };
      case 'status':
        return {
          accessor: 'status',
          title: 'Status',
          width: 180,
          render: (row: PortfolioItem) => <DemandStatusBadge status={row.status} />,
        };
      case 'eligibleForPpp':
        return {
          accessor: 'eligibleForPpp',
          title: 'Eligible for PPP',
          width: 120,
          render: (row: PortfolioItem) => (row.eligibleForPpp ? 'Yes' : 'No'),
        };
      case 'demandPriority':
        return {
          accessor: 'demandPriority',
          title: 'Demand Priority',
          width: 130,
          render: (row: PortfolioItem) => row.demandPriority ?? '—',
        };
      case 'isInflight':
        return {
          accessor: 'isInflight',
          title: 'Inflight',
          width: 80,
          render: (row: PortfolioItem) => (row.isInflight ? 'Yes' : ''),
        };
      case 'relevantYear':
        return {
          accessor: 'relevantYear',
          title: 'Relevant Year',
          width: 110,
          render: (row: PortfolioItem) => row.relevantYear ?? '—',
        };
      case 'forecastOpex':
        return {
          accessor: 'forecastOpex',
          title: 'Forecast OPEX',
          width: 140,
          render: (row: PortfolioItem) => formatCents(row.forecastOpex),
        };
      case 'totalCapex':
        return {
          accessor: 'totalCapex',
          title: 'Total CAPEX',
          width: 120,
          render: (row: PortfolioItem) => formatCents(row.totalCapex),
        };
      case 'totalCosts':
        return {
          accessor: 'totalCosts',
          title: 'Total Costs',
          width: 120,
          render: (row: PortfolioItem) => formatCents(row.totalCosts),
        };
      default:
        return { accessor: col, title: COLUMN_LABELS[col] ?? col };
    }
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const isEmpty = !isFetching && !isError && rows.length === 0;

  return (
    <PageLayout fullWidth>
      <Stack gap="md">
      <PageHeader
        title={t('nav.portfolio')}
        icon={<IconLayoutGrid size={22} />}
        actions={
          <Popover opened={columnPopoverOpen} onChange={setColumnPopoverOpen} position="bottom-end">
          <Popover.Target>
            <Button
              variant="subtle"
              size="sm"
              leftSection={<IconColumns3 size={16} />}
              onClick={() => setColumnPopoverOpen((o) => !o)}
            >
              Columns
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs" maw={260}>
              <Text fw={500} size="sm">Show / Hide Columns</Text>
              <Checkbox.Group
                value={visibleColumns}
                onChange={setVisibleColumns}
              >
                <Stack gap={4}>
                  {FIXED_COLUMNS.map((col) => (
                    <Checkbox
                      key={col}
                      value={col}
                      label={COLUMN_LABELS[col] ?? col}
                      size="xs"
                    />
                  ))}
                </Stack>
              </Checkbox.Group>
              <Button
                size="xs"
                variant="light"
                onClick={() => setVisibleColumns(FIXED_COLUMNS)}
              >
                Show All
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
        }
      />

      <Group gap="sm" wrap="wrap">
          <FilterPresetBar
            presets={PRESETS}
            defaultValue={preset}
            onChange={handlePresetChange}
            label="View"
            width={200}
          />
          <Select
            size="sm"
            placeholder="Year"
            data={YEAR_OPTIONS}
            value={year ? String(year) : ''}
            onChange={(v) => {
              setYear(v ? parseInt(v, 10) : undefined);
              setPage(1);
            }}
            clearable
            style={{ width: 120 }}
          />
          <Select
            size="sm"
            placeholder="Demand Type"
            data={DEMAND_TYPE_OPTIONS}
            value={demandType ?? ''}
            onChange={(v) => {
              setDemandType((v as 'P' | 'SP') || undefined);
              setPage(1);
            }}
            clearable
            style={{ width: 140 }}
          />
          <Select
            size="sm"
            placeholder="Status"
            data={STATUS_OPTIONS}
            value={status ?? ''}
            onChange={(v) => {
              setStatus(v || undefined);
              setPage(1);
            }}
            clearable
            style={{ width: 170 }}
          />
          <Select
            size="sm"
            placeholder="Area"
            data={[
              { value: '', label: 'All Areas' },
              ...areas.map((a) => ({ value: a.id, label: a.name })),
            ]}
            value={areaId ?? ''}
            onChange={(v) => {
              setAreaId(v || undefined);
              setPage(1);
            }}
            clearable
            style={{ width: 160 }}
          />
          <Select
            size="sm"
            placeholder="IT Project Manager"
            data={[
              { value: '', label: 'All Managers' },
              ...persons.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={pmId ?? ''}
            onChange={(v) => {
              setPmId(v || undefined);
              setPage(1);
            }}
            clearable
            style={{ width: 200 }}
          />
      </Group>

      {isError && (
        <Text c="red" size="sm">
          Failed to load portfolio data. Please refresh.
        </Text>
      )}

      {isEmpty ? (
        <EmptyQueueState type="filtered" onClearFilter={handleClearFilters} />
      ) : (
        <ListTableCard>
          <Box style={{ overflow: 'auto' }}>
            <DataTable<PortfolioItem>
              records={rows}
              columns={columns}
              fetching={isFetching}
              totalRecords={total}
              recordsPerPage={50}
              page={page}
              onPageChange={setPage}
              minHeight={200}
              highlightOnHover
              withColumnBorders
              striped
              idAccessor="id"
              noRecordsText="No demands match the current filter"
            />
          </Box>
        </ListTableCard>
      )}
      </Stack>
    </PageLayout>
  );
}
