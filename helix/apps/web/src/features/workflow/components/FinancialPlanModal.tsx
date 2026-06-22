import { Button, Group, Loader, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DemandResponse } from '@helix/shared';
import { FinancialGrid } from '@helix/ui';
import { useGetFinancialPlan, usePatchFinancialPlan } from '../../intake/intake.queries';

interface FinancialPlanModalProps {
  opened: boolean;
  onClose: () => void;
  demand: DemandResponse;
  editable?: boolean;
}

export function FinancialPlanModal({ opened, onClose, demand, editable = false }: FinancialPlanModalProps) {
  const { data, isLoading } = useGetFinancialPlan(demand.id);
  const patchPlan = usePatchFinancialPlan();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Financial Planning — ${demand.title}`}
      size="xl"
    >
      {isLoading && <Loader />}
      {!isLoading && (!data || data.glAccounts.length === 0) && (
        <Text>No financial plan data recorded yet.</Text>
      )}
      {!isLoading && data && data.glAccounts.length > 0 && (
        <FinancialGrid
          glAccounts={data.glAccounts}
          entries={data.entries}
          startDate={demand.startDate ?? null}
          endDate={demand.endDate ?? null}
          readOnly={!editable}
          onCellChange={editable
            ? (glAccountId, category, month, year, valueCents) => {
                patchPlan.mutate(
                  { demandId: demand.id, dto: { entries: [{ glAccountId, category, month, year, valueCents }] } },
                  { onError: () => notifications.show({ color: 'red', title: 'Could not save', message: 'Could not save financial plan entry — please try again.' }) },
                );
              }
            : () => {}}
        />
      )}
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>Close</Button>
      </Group>
    </Modal>
  );
}
