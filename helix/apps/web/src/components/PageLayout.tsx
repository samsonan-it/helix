import { Box } from '@mantine/core';
import { type ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export function PageLayout({ children, fullWidth = false }: PageLayoutProps) {
  return (
    <Box
      px="xl"
      py="lg"
      data-testid="page-layout"
      data-full-width={fullWidth ? 'true' : undefined}
      style={
        fullWidth
          ? { minWidth: 800 }
          : { minWidth: 800, maxWidth: 1440, marginLeft: 'auto', marginRight: 'auto' }
      }
    >
      {children}
    </Box>
  );
}
