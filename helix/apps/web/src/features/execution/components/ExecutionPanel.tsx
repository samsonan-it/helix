import { useState } from 'react';
import { Button, Divider, Paper, Stack, Stepper, Text, Textarea } from '@mantine/core';

const STAGES = ['Initiation', 'Implementation', 'Testing', 'Go-Live', 'Hypercare'] as const;

interface Props {
  currentStage: string | null | undefined;
  isUpdating: boolean;
  onStageChange: (stage: string, comment?: string) => void;
  onInitiateClosure: (comment?: string) => void;
}

export function ExecutionPanel({ currentStage, isUpdating, onStageChange, onInitiateClosure }: Props) {
  const [comment, setComment] = useState('');

  const activeIndex = STAGES.indexOf((currentStage ?? '') as (typeof STAGES)[number]);
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === STAGES.length - 1;

  function handleBack() {
    if (isFirst) return;
    const c = comment.trim() || undefined;
    setComment('');
    onStageChange(STAGES[safeIndex - 1], c);
  }

  function handleNext() {
    if (isLast) return;
    const c = comment.trim() || undefined;
    setComment('');
    onStageChange(STAGES[safeIndex + 1], c);
  }

  function handleClosure() {
    const c = comment.trim() || undefined;
    setComment('');
    onInitiateClosure(c);
  }

  return (
    <Paper withBorder p="md" radius="lg" w={390} style={{ flexShrink: 0 }}>
      <Stack gap="md">
        <Text size="sm" fw={600}>Execution Stage</Text>

        <Stepper active={safeIndex} orientation="vertical" size="sm">
          {STAGES.map((stage) => (
            <Stepper.Step key={stage} label={stage} />
          ))}
        </Stepper>

        <Divider />

        <Textarea
          placeholder="Optional comment…"
          size="xs"
          autosize
          minRows={3}
          maxRows={6}
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />

        <Stack gap="xs">
          {isLast ? (
            <Button
              color="orange"
              variant="outline"
              size="xs"
              loading={isUpdating}
              onClick={handleClosure}
              fullWidth
            >
              Initiate Closure
            </Button>
          ) : (
            <Button
              size="xs"
              loading={isUpdating}
              onClick={handleNext}
              fullWidth
            >
              Next: {STAGES[safeIndex + 1]}
            </Button>
          )}
          <Button
            variant="default"
            size="xs"
            disabled={isFirst || isUpdating}
            onClick={handleBack}
            fullWidth
          >
            Back
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
