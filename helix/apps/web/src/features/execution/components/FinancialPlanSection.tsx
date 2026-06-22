import { Loader, Stack, Text } from '@mantine/core';
import { FinancialGrid, type GridGlAccount, type GridEntry } from '@helix/ui';
import { useProjectFinancialPlan, usePatchProjectFinancialPlan } from '../hooks/useProjectFinancialPlan';

interface Props {
  projectId: string;
  startDate: string | null;
  endDate: string | null;
  isEditable: boolean;
}

export function FinancialPlanSection({ projectId, startDate, endDate, isEditable }: Props) {
  const { data, isLoading } = useProjectFinancialPlan(projectId);
  const { mutate: patchCells, isPending: isSaving } = usePatchProjectFinancialPlan(projectId);

  if (isLoading) {
    return (
      <Stack align="center" py="md">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (!data) {
    return <Text size="sm" c="dimmed">No financial plan data available.</Text>;
  }

  return (
    <Stack gap="xs">
      <FinancialGrid
        glAccounts={data.glAccounts as GridGlAccount[]}
        entries={data.entries as GridEntry[]}
        startDate={startDate}
        endDate={endDate}
        onCellChange={
          isEditable
            ? (glAccountId, category, month, year, valueCents) => {
                patchCells({ entries: [{ glAccountId, category, month, year, valueCents }] });
              }
            : undefined
        }
      />
      {isSaving && <Text size="xs" c="dimmed">Saving...</Text>}
    </Stack>
  );
}
