import { Box, Group, Text, Title } from '@mantine/core';
import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <Box pb="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="xs" align="center">
          {icon}
          <div>
            <Title order={2}>{title}</Title>
            {subtitle && (
              <Text c="dimmed" size="sm">
                {subtitle}
              </Text>
            )}
          </div>
        </Group>
        {actions && <Group>{actions}</Group>}
      </Group>
    </Box>
  );
}
