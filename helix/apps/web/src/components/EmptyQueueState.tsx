import { Button, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';

interface Props {
  type: 'empty' | 'filtered';
  message?: string;
  onClearFilter?: () => void;
}

const DEFAULT_MESSAGES = {
  empty: 'Queue clear — nothing needs your review',
  filtered: 'No demands match the current filter',
};

export function EmptyQueueState({ type, message, onClearFilter }: Props) {
  const displayMessage = message ?? DEFAULT_MESSAGES[type];

  return (
    <Stack align="center" justify="center" py="xl" role="status" aria-live="polite">
      <ThemeIcon size="xl" variant="light" color="gray">
        <IconInbox />
      </ThemeIcon>
      <Text c="dimmed" ta="center">{displayMessage}</Text>
      {type === 'filtered' && onClearFilter && (
        <Button variant="subtle" size="sm" onClick={onClearFilter}>
          Clear filter
        </Button>
      )}
    </Stack>
  );
}
