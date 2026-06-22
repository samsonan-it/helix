import { useState, useEffect } from 'react';
import { Button, Checkbox, Group, Modal, Text, Textarea } from '@mantine/core';

interface AIPrefillModalProps {
  opened: boolean;
  isLoading: boolean;
  onCreateManually: (suppress: boolean) => void;
  onPrefill: (description: string, suppress: boolean) => void;
}

export function AIPrefillModal({ opened, isLoading, onCreateManually, onPrefill }: AIPrefillModalProps) {
  const [description, setDescription] = useState('');
  const [suppress, setSuppress] = useState(false);

  useEffect(() => {
    if (opened) {
      setDescription('');
      setSuppress(false);
    }
  }, [opened]);

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      title="Prefill form with AI"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Text size="sm" mb="sm">
        Describe your project and AI will prefill the form fields based on your description.
      </Text>
      <Textarea
        data-autofocus
        rows={10}
        maxLength={2000}
        placeholder="e.g. We need a data pipeline to ingest sales data from SAP into our BI layer…"
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
        disabled={isLoading}
        mb="sm"
      />
      <Checkbox
        label="Don't show this automatically"
        checked={suppress}
        onChange={(e) => setSuppress(e.currentTarget.checked)}
        disabled={isLoading}
        mb="md"
      />
      <Group justify="flex-end">
        <Button
          variant="default"
          onClick={() => onCreateManually(suppress)}
          disabled={isLoading}
        >
          Create manually
        </Button>
        <Button
          color="stadaRed"
          onClick={() => onPrefill(description, suppress)}
          disabled={description.trim() === '' || isLoading}
          loading={isLoading}
        >
          {isLoading ? 'Analysing…' : '✨ Prefill form'}
        </Button>
      </Group>
    </Modal>
  );
}
