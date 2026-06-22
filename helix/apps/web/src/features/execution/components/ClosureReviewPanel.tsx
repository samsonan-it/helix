import { useState } from 'react';
import { Alert, Button, Drawer, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { type ProjectDetail } from '../api/execution.api';
import { useAcceptClosure } from '../hooks/useAcceptClosure';
import { useReturnClosure } from '../hooks/useReturnClosure';

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

interface Props {
  project: ProjectDetail;
}

export function ClosureReviewPanel({ project }: Props) {
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [returnDrawerOpen, setReturnDrawerOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const acceptMutation = useAcceptClosure(project.id);
  const returnMutation = useReturnClosure(project.id);

  const handleReturnSuccess = () => {
    setReturnDrawerOpen(false);
    setReturnComment('');
    setSubmitAttempted(false);
  };

  return (
    <>
      <Alert color="yellow" title="Closure Submitted for Review" mb="md">
        <Text size="sm" mb="md">
          Submitted by {project.assignedPmName ?? '—'} on {formatDate(project.closureSubmittedAt)}.
          Review the closure submission, then accept or return for rework.
        </Text>
        <Group>
          <Button color="green" onClick={() => setAcceptModalOpen(true)} loading={acceptMutation.isPending}>
            Accept Closure
          </Button>
          <Button color="orange" variant="outline" onClick={() => setReturnDrawerOpen(true)}>
            Return for Rework
          </Button>
        </Group>
      </Alert>

      <Modal
        opened={acceptModalOpen}
        onClose={() => setAcceptModalOpen(false)}
        title="Accept Project Closure"
      >
        <Text mb="md">Are you sure you want to accept this closure? The project will be marked as Completed.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setAcceptModalOpen(false)}>No</Button>
          <Button
            color="green"
            loading={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate(undefined, { onSuccess: () => setAcceptModalOpen(false) })}
          >
            Yes, accept
          </Button>
        </Group>
      </Modal>

      <Drawer
        opened={returnDrawerOpen}
        onClose={handleReturnSuccess}
        title="Return Closure for Rework"
        position="right"
      >
        <Stack p="md">
          <Textarea
            label="Reason for return"
            description="Required. This will be included in the notification email to the PM."
            required
            value={returnComment}
            onChange={(e) => setReturnComment(e.currentTarget.value)}
            error={submitAttempted && !returnComment.trim() ? 'Reason is required' : undefined}
            minRows={3}
          />
          <Button
            disabled={!returnComment.trim()}
            loading={returnMutation.isPending}
            onClick={() => {
              setSubmitAttempted(true);
              if (returnComment.trim()) {
                returnMutation.mutate(returnComment.trim(), { onSuccess: handleReturnSuccess });
              }
            }}
          >
            Confirm Return
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
