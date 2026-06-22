import { Modal } from '@mantine/core';
import { DemandHistoryList } from './DemandHistoryList';

interface Props {
  demandId: string;
  opened: boolean;
  onClose: () => void;
}

export function WorkflowHistoryModal({ demandId, opened, onClose }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="Workflow History" size="lg">
      <DemandHistoryList demandId={demandId} />
    </Modal>
  );
}
