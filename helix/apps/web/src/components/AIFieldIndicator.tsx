import { ReactNode, useId, cloneElement, isValidElement } from 'react';
import { Box, Text } from '@mantine/core';

interface AIFieldIndicatorProps {
  isAISuggested: boolean;
  children: ReactNode;
}

export function AIFieldIndicator({ isAISuggested, children }: AIFieldIndicatorProps) {
  const hintId = useId();

  if (!isAISuggested) {
    return <>{children}</>;
  }

  const childWithAria = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': hintId,
      })
    : children;

  return (
    <Box bd="2px solid var(--mantine-color-orange-6)" bdrs="xs" p={2}>
      {childWithAria}
      <Text id={hintId} size="xs" c="orange.6" mt={4}>
        AI suggested — review before submitting
      </Text>
    </Box>
  );
}
