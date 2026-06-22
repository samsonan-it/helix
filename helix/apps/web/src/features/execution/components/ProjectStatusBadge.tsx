import { Badge } from '@mantine/core';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT:               { label: 'Draft',               color: 'yellow' },
  PENDING_APPROVAL:    { label: 'Pending Approval',     color: 'yellow' },
  IN_EXECUTION:        { label: 'In Execution',         color: 'teal'   },
  ASSUMED_COMPLETED:   { label: 'Needs Review',         color: 'orange' },
  PREPARE_FOR_CLOSURE: { label: 'Preparing Closure',    color: 'stadaBlue' },
  COMPLETED:           { label: 'Completed',            color: 'green'  },
  CANCELLED:           { label: 'Cancelled',            color: 'gray'   },
};

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export function ProjectStatusBadge({ status, size = 'md' }: Props) {
  const { label, color } = STATUS_MAP[status] ?? { label: status, color: 'gray' };
  return <Badge color={color} size={size}>{label}</Badge>;
}
