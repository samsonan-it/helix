import { Badge, Text } from '@mantine/core';
import { DataTable, type DataTableColumn } from 'mantine-datatable';
import { type ProjectItem } from '../api/execution.api';
import { ListTableCard } from '../../../components/ListTableCard';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { DemandTypeIndicator } from '../../../components/DemandTypeIndicator';

const RAG_COLOR: Record<string, string> = { GREEN: 'teal', AMBER: 'orange', RED: 'red' };
const RAG_LABEL: Record<string, string> = { GREEN: 'Green', AMBER: 'Amber', RED: 'Red' };

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  records: ProjectItem[];
  total: number;
  page: number;
  pageSize: number;
  fetching: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
}

const COLUMNS: DataTableColumn<ProjectItem>[] = [
  {
    accessor: 'publicId',
    title: '#',
    width: 60,
    render: (row) => <Text size="sm" c="dimmed">{row.publicId}</Text>,
  },
  {
    accessor: 'title',
    title: 'Project Name',
    width: 200,
    render: (row) => <Text size="sm" fw={600}>{row.title}</Text>,
  },
  {
    accessor: 'demandType',
    title: 'Type',
    width: 70,
    render: (row) => <DemandTypeIndicator type={row.demandType} />,
  },
  {
    accessor: 'startDate',
    title: 'Start Date',
    width: 120,
    render: (row) => fmtDate(row.startDate),
  },
  {
    accessor: 'endDate',
    title: 'End Date',
    width: 120,
    render: (row) => fmtDate(row.endDate),
  },
  {
    accessor: 'overallRag',
    title: 'Overall RAG',
    width: 120,
    render: (row) => row.overallRag
      ? <Badge color={RAG_COLOR[row.overallRag] ?? 'gray'} size="sm">{RAG_LABEL[row.overallRag] ?? row.overallRag}</Badge>
      : <Text size="sm" c="dimmed">Not Reported</Text>,
  },
  {
    accessor: 'status',
    title: 'Status',
    width: 160,
    render: (row) => <ProjectStatusBadge status={row.status} />,
  },
  {
    accessor: 'currentStage',
    title: 'Stage',
    width: 130,
    render: (row) => row.currentStage ?? '—',
  },
];

export function ProjectList({ records, total, page, pageSize, fetching, selectedId, onSelect, onPageChange }: Props) {
  return (
    <ListTableCard>
      <DataTable<ProjectItem>
        records={records}
        columns={COLUMNS}
        fetching={fetching}
        totalRecords={total}
        recordsPerPage={pageSize}
        page={page}
        onPageChange={onPageChange}
        minHeight={200}
        highlightOnHover
        idAccessor="id"
        rowStyle={({ id }) => id === selectedId ? { backgroundColor: 'var(--mantine-color-stadaBlue-0)' } : undefined}
        onRowClick={({ record }) => onSelect(record.id)}
        noRecordsText="No projects found"
      />
    </ListTableCard>
  );
}
