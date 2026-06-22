import { useRef, useState } from 'react';
import { Alert, Button, Checkbox, Stack, Text, Textarea } from '@mantine/core';
import { type ProjectDetail as ProjectDetailType } from '../api/execution.api';
import { useUploadHandoverDocument } from '../hooks/useUploadHandoverDocument';
import { useSubmitClosure } from '../hooks/useSubmitClosure';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  project: ProjectDetailType;
  isActor: boolean;
}

export function ClosureForm({ project, isActor }: Props) {
  const [workDelivered, setWorkDelivered] = useState(false);
  const [financialReconciled, setFinancialReconciled] = useState(false);
  const [pmSummaryNotes, setPmSummaryNotes] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    project.closureHandoverDocumentPath
      ? (project.closureHandoverDocumentPath.split('/').pop() ?? 'document')
      : null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: uploadDoc, isPending: isUploading } = useUploadHandoverDocument(project.id);
  const { mutate: submit, isPending: isSubmitting } = useSubmitClosure(project.id);

  if (project.closureSubmittedAt) {
    return (
      <Alert title="Closure submitted" color="blue">
        Submitted on {fmtDate(project.closureSubmittedAt)}. Awaiting Portfolio Manager review.
      </Alert>
    );
  }

  const hasDocument = uploadedFileName !== null;
  const canSubmit = workDelivered && financialReconciled && hasDocument;

  const missingItems: string[] = [];
  if (!workDelivered) missingItems.push('confirm work delivered');
  if (!financialReconciled) missingItems.push('confirm financial reconciliation');
  if (!hasDocument) missingItems.push('upload handover document');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    uploadDoc(file, {
      onSuccess: (result) => {
        setUploadedFileName(result.fileName);
      },
      onError: () => {
        setUploadedFileName(null);
        setUploadError('Upload failed. Please try again.');
      },
    });
    e.target.value = '';
  }

  function handleSubmit() {
    if (!canSubmit) return;
    submit({
      workDelivered: true,
      financialReconciled: true,
      pmSummaryNotes: pmSummaryNotes.trim() || undefined,
    });
  }

  return (
    <Stack gap="md">
      <Checkbox
        checked={workDelivered}
        onChange={(e) => setWorkDelivered(e.currentTarget.checked)}
        label="Work delivered / transferred to operations"
        disabled={!isActor}
      />

      <Checkbox
        checked={financialReconciled}
        onChange={(e) => setFinancialReconciled(e.currentTarget.checked)}
        label="Financial reconciliation complete — all SAP actuals imported or confirmed no further actuals expected"
        disabled={!isActor}
        // TODO: AC-4 per-month validation — blocked on Story 6.9
      />

      <Stack gap={4}>
        <Text size="sm" fw={500}>Signed handover document <Text component="span" c="red">*</Text></Text>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <Button
          variant="light"
          size="xs"
          onClick={() => fileInputRef.current?.click()}
          loading={isUploading}
          disabled={!isActor}
        >
          {uploadedFileName ? 'Replace file' : 'Upload document'}
        </Button>
        {uploadedFileName && (
          <Text size="xs" c="dimmed">{uploadedFileName}</Text>
        )}
        {uploadError && (
          <Text size="xs" c="red">{uploadError}</Text>
        )}
      </Stack>

      <Textarea
        label="PM Summary Notes"
        placeholder="Optional summary notes (max 2000 characters)"
        maxLength={2000}
        value={pmSummaryNotes}
        onChange={(e) => setPmSummaryNotes(e.currentTarget.value)}
        disabled={!isActor}
        autosize
        minRows={3}
      />

      {isActor && (
        <>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isUploading}
            loading={isSubmitting}
          >
            Submit Closure
          </Button>
          {!canSubmit && (
            <Text c="dimmed" size="xs">
              Still required: {missingItems.join(', ')}.
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}
