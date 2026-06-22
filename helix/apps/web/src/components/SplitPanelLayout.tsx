import { ActionIcon, Box, Group } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { ReactNode, useEffect, useState } from 'react';
import { useShellStore } from '../stores/shell.store';

interface Props {
  list: ReactNode;
  detail: ReactNode;
  collapseAt?: number;
  selectedId: string | null;
  onBack?: () => void;
}

export function SplitPanelLayout({ list, detail, collapseAt = 1024, selectedId, onBack }: Props) {
  const navbarOpen = useShellStore((s) => s.navbarOpen);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const collapsed = windowWidth < collapseAt;

  if (collapsed) {
    return (
      <Box style={{ height: '100%' }}>
        {selectedId ? (
          <Box style={{ height: '100%', minWidth: 0 }}>
            {onBack && (
              <Group mb="sm">
                <ActionIcon variant="subtle" onClick={onBack} aria-label="Back to list">
                  <IconArrowLeft size={18} />
                </ActionIcon>
              </Group>
            )}
            {detail}
          </Box>
        ) : (
          list
        )}
      </Box>
    );
  }

  return (
    <Box
      style={{
        display: 'flex',
        height: '100%',
        gap: 0,
        // Shrink list panel when navbar is open to avoid overflow
        width: navbarOpen ? undefined : '100%',
      }}
    >
      <Box style={{ flex: '0 0 30%', overflow: 'auto' }}>{list}</Box>
      <Box style={{ flex: '0 0 70%', minWidth: 0, overflow: 'auto' }}>{detail}</Box>
    </Box>
  );
}
