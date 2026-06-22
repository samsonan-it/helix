import { useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { type ProjectDetail } from '../api/execution.api';
import { useApproveCharter } from '../hooks/useApproveCharter';
import { useReturnCharter } from '../hooks/useReturnCharter';

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  project: ProjectDetail;
}

export function CharterApprovalPanel({ project }: Props) {
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');

  const { mutate: approve, isPending: isApprovePending } = useApproveCharter(project.id);
  const { mutate: returnForRework, isPending: isReturnPending } = useReturnCharter(project.id);

  function handleApprove() {
    approve(undefined, {
      onSuccess: () => {
        notifications.show({
          title: 'Charter approved',
          message: 'The project is now in execution.',
          color: 'green',
        });
      },
    });
  }

  function handleReturnSubmit() {
    if (!comment.trim()) {
      setCommentError('A reason is required');
      return;
    }
    returnForRework(comment.trim(), {
      onSuccess: () => {
        setReturnModalOpen(false);
        setComment('');
        setCommentError('');
        notifications.show({
          title: 'Charter returned',
          message: 'The project has been returned to DRAFT for rework.',
          color: 'orange',
        });
      },
    });
  }

  return (
    <>
      <Alert color="blue" title="Charter Pending Approval" mb="md">
        <Text size="sm" mb="md">
          Submitted by {project.assignedPmName ?? '—'} on {formatDate(project.charterSubmittedAt)}.
          Review the charter fields below, then approve or return for rework.
        </Text>
        <Group>
          <Button color="green" onClick={handleApprove} loading={isApprovePending}>
            Approve & Start Project
          </Button>
          <Button color="orange" variant="outline" onClick={() => setReturnModalOpen(true)}>
            Return for Rework
          </Button>
        </Group>
      </Alert>

      <Modal
        opened={returnModalOpen}
        onClose={() => { setReturnModalOpen(false); setComment(''); setCommentError(''); }}
        title="Return Charter for Rework"
        centered
      >
        <Stack>
          <Textarea
            label="Reason for return"
            placeholder="Explain what needs to be revised..."
            required
            value={comment}
            onChange={(e) => { setComment(e.currentTarget.value); setCommentError(''); }}
            error={commentError}
            autosize
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => { setReturnModalOpen(false); setComment(''); setCommentError(''); }}>
              Cancel
            </Button>
            <Button
              color="orange"
              onClick={handleReturnSubmit}
              loading={isReturnPending}
              disabled={!comment.trim()}
            >
              Return for Rework
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
