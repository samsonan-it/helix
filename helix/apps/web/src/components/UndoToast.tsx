import { Button, Group, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

interface Props {
  message: string;
  onUndo: () => void;
  duration?: number;
}

export function UndoToast({ message, onUndo, duration = 8000 }: Props) {
  const [remaining, setRemaining] = useState(Math.ceil(duration / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(r - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <Group
      role="alert"
      justify="space-between"
      p="sm"
      style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 'var(--mantine-radius-md)' }}
    >
      <Group gap="xs">
        <Text size="sm" c="white">{message}</Text>
        <Text size="sm" c="dimmed" aria-live="off">
          <span>{remaining}s</span>
        </Text>
      </Group>
      <Button variant="subtle" color="white" size="xs" onClick={onUndo}>
        Undo
      </Button>
    </Group>
  );
}
