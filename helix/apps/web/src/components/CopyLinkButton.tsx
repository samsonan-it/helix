import { ActionIcon, Tooltip } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { IconLink } from '@tabler/icons-react';

export function CopyLinkButton() {
  const clipboard = useClipboard({ timeout: 2000 });
  return (
    <Tooltip label={clipboard.copied ? 'Copied!' : 'Copy link'} withArrow>
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label="Copy link"
        onClick={() => clipboard.copy(window.location.href)}
      >
        <IconLink size={16} />
      </ActionIcon>
    </Tooltip>
  );
}
