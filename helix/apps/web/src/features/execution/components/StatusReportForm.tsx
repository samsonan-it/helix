import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import {
  Alert,
  Button,
  Divider,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { createStatusReportSchema } from '@helix/shared';
import { type ProjectDetail, type StatusReportItem, type RagValue } from '../api/execution.api';
import { useSubmitStatusReport } from '../hooks/useSubmitStatusReport';

interface Props {
  project: ProjectDetail;
  latestReport: StatusReportItem | null;
}

const RAG_DIMS: Array<{ ragField: string; explField: string; label: string }> = [
  { ragField: 'overallRag',        explField: 'overallExplanation',        label: 'Overall' },
  { ragField: 'scheduleRag',       explField: 'scheduleExplanation',       label: 'Schedule' },
  { ragField: 'resourcesRag',      explField: 'resourcesExplanation',      label: 'Resources' },
  { ragField: 'budgetCurrentRag',  explField: 'budgetCurrentExplanation',  label: 'Budget (Current)' },
  { ragField: 'budgetForecastRag', explField: 'budgetForecastExplanation', label: 'Budget (Forecast)' },
  { ragField: 'stakeholdersRag',   explField: 'stakeholdersExplanation',   label: 'Stakeholders' },
  { ragField: 'valuePropRag',      explField: 'valuePropExplanation',      label: 'Value Proposition' },
  { ragField: 'providerRag',       explField: 'providerExplanation',       label: 'Provider' },
];

const RAG_DATA = [
  { value: 'GREEN', label: 'Green' },
  { value: 'AMBER', label: 'Amber' },
  { value: 'RED',   label: 'Red' },
];

function ragColor(rag: string): string {
  if (rag === 'GREEN') return 'teal';
  if (rag === 'AMBER') return 'orange';
  return 'red';
}

type FormValues = {
  overallRag: RagValue;
  scheduleRag: RagValue;
  resourcesRag: RagValue;
  budgetCurrentRag: RagValue;
  budgetForecastRag: RagValue;
  stakeholdersRag: RagValue;
  valuePropRag: RagValue;
  providerRag: RagValue;
  overallExplanation: string;
  scheduleExplanation: string;
  resourcesExplanation: string;
  budgetCurrentExplanation: string;
  budgetForecastExplanation: string;
  stakeholdersExplanation: string;
  valuePropExplanation: string;
  providerExplanation: string;
  keyAccomplishments: string;
  nextSteps: string;
  goLiveDate: string;
};

export function StatusReportForm({ project, latestReport }: Props) {
  const navigate = useNavigate();
  const submitMutation = useSubmitStatusReport(project.id);

  const originalGoLiveDate = project.endDate
    ? new Date(project.endDate).toISOString().split('T')[0]
    : '';

  const initialValues: FormValues = latestReport
    ? {
        overallRag:        latestReport.overallRag,
        scheduleRag:       latestReport.scheduleRag,
        resourcesRag:      latestReport.resourcesRag,
        budgetCurrentRag:  latestReport.budgetCurrentRag,
        budgetForecastRag: latestReport.budgetForecastRag,
        stakeholdersRag:   latestReport.stakeholdersRag,
        valuePropRag:      latestReport.valuePropRag,
        providerRag:       latestReport.providerRag,
        overallExplanation:        latestReport.overallExplanation ?? '',
        scheduleExplanation:       latestReport.scheduleExplanation ?? '',
        resourcesExplanation:      latestReport.resourcesExplanation ?? '',
        budgetCurrentExplanation:  latestReport.budgetCurrentExplanation ?? '',
        budgetForecastExplanation: latestReport.budgetForecastExplanation ?? '',
        stakeholdersExplanation:   latestReport.stakeholdersExplanation ?? '',
        valuePropExplanation:      latestReport.valuePropExplanation ?? '',
        providerExplanation:       latestReport.providerExplanation ?? '',
        keyAccomplishments: latestReport.keyAccomplishments ?? '',
        nextSteps:          latestReport.nextSteps ?? '',
        goLiveDate:         latestReport.goLiveDate
          ? new Date(latestReport.goLiveDate).toISOString().split('T')[0]
          : originalGoLiveDate,
      }
    : {
        overallRag:        'GREEN',
        scheduleRag:       'GREEN',
        resourcesRag:      'GREEN',
        budgetCurrentRag:  'GREEN',
        budgetForecastRag: 'GREEN',
        stakeholdersRag:   'GREEN',
        valuePropRag:      'GREEN',
        providerRag:       'GREEN',
        overallExplanation:        '',
        scheduleExplanation:       '',
        resourcesExplanation:      '',
        budgetCurrentExplanation:  '',
        budgetForecastExplanation: '',
        stakeholdersExplanation:   '',
        valuePropExplanation:      '',
        providerExplanation:       '',
        keyAccomplishments: '',
        nextSteps:          '',
        goLiveDate:         originalGoLiveDate,
      };

  const form = useForm<FormValues>({
    initialValues,
    validate: (values) => {
      const dto = {
        overallRag:        values.overallRag,
        scheduleRag:       values.scheduleRag,
        resourcesRag:      values.resourcesRag,
        budgetCurrentRag:  values.budgetCurrentRag,
        budgetForecastRag: values.budgetForecastRag,
        stakeholdersRag:   values.stakeholdersRag,
        valuePropRag:      values.valuePropRag,
        providerRag:       values.providerRag,
        overallExplanation:        values.overallExplanation || null,
        scheduleExplanation:       values.scheduleExplanation || null,
        resourcesExplanation:      values.resourcesExplanation || null,
        budgetCurrentExplanation:  values.budgetCurrentExplanation || null,
        budgetForecastExplanation: values.budgetForecastExplanation || null,
        stakeholdersExplanation:   values.stakeholdersExplanation || null,
        valuePropExplanation:      values.valuePropExplanation || null,
        providerExplanation:       values.providerExplanation || null,
        keyAccomplishments: values.keyAccomplishments || null,
        nextSteps:          values.nextSteps || null,
        goLiveDate:         values.goLiveDate
          ? new Date(values.goLiveDate).toISOString()
          : null,
      };
      const result = createStatusReportSchema.safeParse(dto);
      if (result.success) return {};
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (key) errors[key] = issue.message;
      }
      return errors;
    },
  });

  const [showGoLivePrompt, setShowGoLivePrompt] = useState(false);

  // P1: track textarea refs per explanation field to programmatically focus when RAG goes non-green
  const explRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const prevRagValues = useRef<Record<string, string>>({});

  const {
    overallRag, scheduleRag, resourcesRag, budgetCurrentRag,
    budgetForecastRag, stakeholdersRag, valuePropRag, providerRag,
  } = form.values;

  useEffect(() => {
    for (const { ragField, explField } of RAG_DIMS) {
      const prev = prevRagValues.current[ragField];
      const curr = form.values[ragField as keyof FormValues] as string;
      if (prev === 'GREEN' && curr !== 'GREEN') {
        explRefs.current[explField]?.focus();
      }
      prevRagValues.current[ragField] = curr;
    }
  }, [overallRag, scheduleRag, resourcesRag, budgetCurrentRag, budgetForecastRag, stakeholdersRag, valuePropRag, providerRag]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = form.onSubmit(async (values) => {
    await submitMutation.mutateAsync({
      overallRag:        values.overallRag,
      scheduleRag:       values.scheduleRag,
      resourcesRag:      values.resourcesRag,
      budgetCurrentRag:  values.budgetCurrentRag,
      budgetForecastRag: values.budgetForecastRag,
      stakeholdersRag:   values.stakeholdersRag,
      valuePropRag:      values.valuePropRag,
      providerRag:       values.providerRag,
      overallExplanation:        values.overallExplanation || null,
      scheduleExplanation:       values.scheduleExplanation || null,
      resourcesExplanation:      values.resourcesExplanation || null,
      budgetCurrentExplanation:  values.budgetCurrentExplanation || null,
      budgetForecastExplanation: values.budgetForecastExplanation || null,
      stakeholdersExplanation:   values.stakeholdersExplanation || null,
      valuePropExplanation:      values.valuePropExplanation || null,
      providerExplanation:       values.providerExplanation || null,
      keyAccomplishments: values.keyAccomplishments || null,
      nextSteps:          values.nextSteps || null,
      goLiveDate:         values.goLiveDate
        ? new Date(values.goLiveDate).toISOString()
        : null,
    });
    navigate(`/projects/${project.id}`);
  });

  if (submitMutation.isPending) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">Submitting status report…</Text>
      </Stack>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        <Title order={5}>RAG Status</Title>

        {RAG_DIMS.map(({ ragField, explField, label }) => {
          const ragValue = form.values[ragField as keyof FormValues] as string;
          return (
            <Stack key={ragField} gap={4}>
              <Text size="sm" fw={500}>{label}</Text>
              <SegmentedControl
                data={RAG_DATA}
                color={ragColor(ragValue)}
                {...form.getInputProps(ragField)}
              />
              {ragValue !== 'GREEN' && (
                <Textarea
                  ref={(el) => { explRefs.current[explField] = el; }}
                  placeholder="Explanation required"
                  error={form.errors[explField]}
                  {...form.getInputProps(explField)}
                />
              )}
            </Stack>
          );
        })}

        <Divider label="Additional Details" labelPosition="left" />

        <TextInput
          label="Go-Live Date"
          type="date"
          {...form.getInputProps('goLiveDate')}
          onChange={(e) => {
            const newDate = e.currentTarget.value;
            form.setFieldValue('goLiveDate', newDate);
            if (!newDate || newDate === originalGoLiveDate) {
              setShowGoLivePrompt(false);
            } else if (form.values.scheduleRag === 'GREEN') {
              setShowGoLivePrompt(true);
            }
          }}
        />

        {showGoLivePrompt && (
          <Alert title="Go-live date changed" color="yellow">
            A go-live date change suggests a delay — update schedule status?
            <Group mt="xs">
              <Button
                size="xs"
                color="orange"
                onClick={() => {
                  form.setFieldValue('scheduleRag', 'AMBER');
                  setShowGoLivePrompt(false);
                }}
              >
                Update to Amber
              </Button>
              <Button size="xs" variant="subtle" onClick={() => setShowGoLivePrompt(false)}>
                Dismiss
              </Button>
            </Group>
          </Alert>
        )}

        <Textarea
          label="Key Accomplishments"
          placeholder="What was achieved this period?"
          minRows={3}
          {...form.getInputProps('keyAccomplishments')}
        />

        <Textarea
          label="Next Steps"
          placeholder="What are the planned actions for the next period?"
          minRows={3}
          {...form.getInputProps('nextSteps')}
        />

        {submitMutation.isError && (
          <Alert color="stadaRed" title="Submission failed">
            Could not submit the status report. Please try again.
          </Alert>
        )}

        <Button type="submit" disabled={!form.isValid()}>
          Submit Status Report
        </Button>
      </Stack>
    </form>
  );
}
