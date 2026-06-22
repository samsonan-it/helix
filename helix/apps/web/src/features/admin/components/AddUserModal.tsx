import { useState } from 'react';
import { Modal, TextInput, Button, Group, Alert, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useCreateUser } from '../hooks/useCreateUser';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function AddUserModal({ opened, onClose }: Props): JSX.Element {
  const [conflictError, setConflictError] = useState(false);
  const { mutate: createUser, isPending } = useCreateUser();

  const form = useForm({
    initialValues: { name: '', email: '' },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Display name is required' : null),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Valid email is required'),
    },
  });

  function handleClose() {
    form.reset();
    setConflictError(false);
    onClose();
  }

  function handleSubmit(values: { name: string; email: string }) {
    setConflictError(false);
    createUser(values, {
      onSuccess: handleClose,
      onError: (err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) {
          setConflictError(true);
        }
      },
    });
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Add User" size="sm">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Display name"
            required
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Email"
            type="email"
            required
            {...form.getInputProps('email')}
          />
          {conflictError && (
            <Alert color="stadaRed">A user with this email already exists</Alert>
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" color="stadaRed" loading={isPending}>
              Add User
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
