import { Paper } from '@mantine/core';
import { type ReactNode } from 'react';

interface ListTableCardProps {
  children: ReactNode;
}

export function ListTableCard({ children }: ListTableCardProps) {
  return (
    <Paper withBorder shadow="sm" radius="sm" className="list-table-card" style={{ overflow: 'hidden' }}>
      {children}
    </Paper>
  );
}
