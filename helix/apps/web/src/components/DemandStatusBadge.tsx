import { Badge, Group } from '@mantine/core';
import { DemandStatus } from '@helix/shared';

const STATUS_MAP: Record<DemandStatus, { label: string; color: string }> = {
  [DemandStatus.DRAFT]:        { label: 'Draft',                  color: 'gray'   },
  [DemandStatus.SUBMITTED]:    { label: 'Pending DM Review',      color: 'stadaBlue' },
  [DemandStatus.BC_REVIEW]:       { label: 'Pending BC Approval',       color: 'violet'    },
  [DemandStatus.SP_OFFER_REVIEW]: { label: 'Awaiting Requester Review',  color: 'cyan'      },
  [DemandStatus.IN_REVIEW]:       { label: 'Awaiting PM Approval',       color: 'stadaBlue' },
  [DemandStatus.REROUTED]:     { label: 'Rework Needed',          color: 'orange'    },
  [DemandStatus.APPROVED]:     { label: 'Approved',               color: 'green'     },
  [DemandStatus.REJECTED]:     { label: 'Rejected',               color: 'stadaRed'  },
  [DemandStatus.ON_HOLD]:      { label: 'On Hold',                color: 'yellow' },
  [DemandStatus.IN_EXECUTION]: { label: 'In Delivery',            color: 'teal'   },
  [DemandStatus.COMPLETED]:    { label: 'Completed',              color: 'gray'   },
  [DemandStatus.CANCELLED]:    { label: 'Cancelled',              color: 'gray'   },
};

interface Props {
  status: DemandStatus;
  size?: 'sm' | 'md';
  isStalled?: boolean;
}

export function DemandStatusBadge({ status, size = 'md', isStalled = false }: Props) {
  const { label, color } = STATUS_MAP[status] ?? { label: status, color: 'gray' };
  return (
    <Group gap={4} wrap="nowrap">
      <Badge color={color} size={size}>{label}</Badge>
      {isStalled && (
        <Badge color="orange" size={size}>Stalled</Badge>
      )}
    </Group>
  );
}
