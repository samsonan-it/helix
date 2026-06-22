import { Badge } from '@mantine/core';

interface Props {
  type: 'P' | 'SP' | null;
}

export function DemandTypeIndicator({ type }: Props) {
  if (!type) return null;
  return (
    <Badge size="sm" color={type === 'SP' ? 'green' : 'blue'}>
      {type}
    </Badge>
  );
}
