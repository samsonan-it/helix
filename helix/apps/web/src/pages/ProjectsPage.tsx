import { useState } from 'react';
import { Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconBriefcase, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { PageLayout } from '../components/PageLayout';
import { EmptyQueueState } from '../components/EmptyQueueState';
import { ProjectList } from '../features/execution/components/ProjectList';
import { useProjectList } from '../features/execution/hooks/useProjectList';

const STATUS_FILTER_OPTIONS = [
  { label: 'Active', value: '' },
  { label: 'Completed', value: 'COMPLETED' },
];

export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const handleSelect = (id: string) => navigate(`/projects/${id}`);

  const filters = { page, pageSize: 50, ...(statusFilter ? { status: statusFilter } : {}) };
  const { data, isFetching, isError } = useProjectList(filters);

  const allRows = data?.data ?? [];
  const rows = search.trim()
    ? allRows.filter(r => r.title.toLowerCase().includes(search.trim().toLowerCase()))
    : allRows;
  const total = search.trim() ? rows.length : (data?.total ?? 0);
  const isEmpty = !isFetching && !isError && rows.length === 0;

  return (
    <PageLayout>
      <Stack gap="sm">
      <PageHeader title={t('nav.projects')} icon={<IconBriefcase size={22} />} />
      <Group gap="xs" align="center">
        <TextInput
          placeholder="Search projects…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          size="sm"
          maw={400}
        />
        <Select
          aria-label="Status"
          size="sm"
          data={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v ?? ''); setPage(1); }}
          allowDeselect={false}
          w={160}
        />
      </Group>
      {isError && <Text c="red" size="sm">Failed to load projects. Please refresh.</Text>}
      {isEmpty ? (
        <EmptyQueueState type="empty" />
      ) : (
        <ProjectList
          records={rows}
          total={total}
          page={page}
          pageSize={50}
          fetching={isFetching}
          selectedId={null}
          onSelect={handleSelect}
          onPageChange={setPage}
        />
      )}
      </Stack>
    </PageLayout>
  );
}
