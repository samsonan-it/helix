import { useState } from 'react';
import { Alert, Button, Checkbox, Collapse, Group, Stack, Table, Text, Title } from '@mantine/core';
import { IconDatabase } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '../../../components/PageHeader';
import { PageLayout } from '../../../components/PageLayout';
import { BulkInternalOrdersResult, postBulkInternalOrders } from '../api/admin.api';

export function SapIntegrationAdminPage(): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<BulkInternalOrdersResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const { mutate: upload, isPending, isError, error } = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      return postBulkInternalOrders(file, overwrite);
    },
    onSuccess: (data) => {
      setResult(data);
      setShowErrors(data.errors.length > 0);
    },
  });

  const apiError = isError && error instanceof Error ? error.message : null;

  return (
    <PageLayout>
      <Stack gap="md">
        <PageHeader title="SAP Integration" icon={<IconDatabase size={22} />} />

        <Title order={4}>Internal Order Batch Import</Title>
        <Text size="sm" c="dimmed">
          Upload a CSV with columns: <code>helix_project_id, opex_internal_order, capex_internal_order</code>
        </Text>

        <Stack gap="sm" maw={480}>
          <div>
            <Text size="sm" fw={500} mb={4}>CSV File</Text>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
              style={{ display: 'block' }}
            />
          </div>

          <Checkbox
            label="Overwrite existing values"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.currentTarget.checked)}
          />

          <Group>
            <Button
              color="stadaRed"
              loading={isPending}
              disabled={!file}
              onClick={() => upload()}
            >
              Import
            </Button>
          </Group>
        </Stack>

        {apiError && (
          <Alert color="stadaRed" title="Import failed">{apiError}</Alert>
        )}

        {result && (
          <Stack gap="xs">
            <Alert
              color={result.errors.length === 0 ? 'green' : 'orange'}
              title={result.errors.length === 0 ? 'Import successful' : 'Import completed with errors'}
            >
              Imported: {result.imported} &nbsp;|&nbsp; Skipped: {result.skipped} &nbsp;|&nbsp; Errors: {result.errors.length}
            </Alert>

            {result.errors.length > 0 && (
              <>
                <Button variant="subtle" size="compact-sm" onClick={() => setShowErrors((v) => !v)}>
                  {showErrors ? 'Hide errors' : 'Show errors'}
                </Button>
                <Collapse in={showErrors}>
                  <Table striped withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Row</Table.Th>
                        <Table.Th>Project ID</Table.Th>
                        <Table.Th>Reason</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.errors.map((err) => (
                        <Table.Tr key={`${err.row}-${err.helix_project_id}`}>
                          <Table.Td>{err.row}</Table.Td>
                          <Table.Td><code>{err.helix_project_id}</code></Table.Td>
                          <Table.Td>{err.reason}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Collapse>
              </>
            )}
          </Stack>
        )}
      </Stack>
    </PageLayout>
  );
}
