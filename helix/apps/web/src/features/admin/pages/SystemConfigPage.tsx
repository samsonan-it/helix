import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import { DatePickerInput } from '@mantine/dates';
import {
  Alert,
  Button,
  Divider,
  Group,
  NumberInput,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { UpdateSystemConfigDto } from '@helix/shared';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useUpdateSystemConfig } from '../hooks/useUpdateSystemConfig';
import { PageHeader } from '../../../components/PageHeader';
import { PageLayout } from '../../../components/PageLayout';

interface FormValues {
  spThresholdEuros:      number;
  intakeWindowStart:     Date | null;
  intakeWindowEnd:       Date | null;
  budgetCycleStart:      Date | null;
  budgetCycleEnd:        Date | null;
  gxpItValidationDays:   number;
  gxpDocumentationDays:  number;
}

function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso) : null;
}

export function SystemConfigPage(): JSX.Element {
  const { data: config, isPending, isError, refetch } = useSystemConfig();
  const { mutate: update, isPending: isSaving } = useUpdateSystemConfig();

  const form = useForm<FormValues>({
    initialValues: {
      spThresholdEuros:      50_000,
      intakeWindowStart:     null,
      intakeWindowEnd:       null,
      budgetCycleStart:      null,
      budgetCycleEnd:        null,
      gxpItValidationDays:   30,
      gxpDocumentationDays:  14,
    },
  });

  useEffect(() => {
    if (config) {
      form.setValues({
        spThresholdEuros:      Math.round(config.spThresholdEurCents / 100),
        intakeWindowStart:     toDate(config.intakeWindowStart),
        intakeWindowEnd:       toDate(config.intakeWindowEnd),
        budgetCycleStart:      toDate(config.budgetCycleStart),
        budgetCycleEnd:        toDate(config.budgetCycleEnd),
        gxpItValidationDays:   config.gxpItValidationDays,
        gxpDocumentationDays:  config.gxpDocumentationDays,
      });
      form.resetDirty();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  // Only re-initialize when config loads — not on every form change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  function handleSave(values: FormValues): void {
    const dto: UpdateSystemConfigDto = {};

    if (form.isDirty('spThresholdEuros'))     dto.spThresholdEurCents  = values.spThresholdEuros * 100;
    if (form.isDirty('intakeWindowStart'))    dto.intakeWindowStart    = values.intakeWindowStart?.toISOString() ?? null;
    if (form.isDirty('intakeWindowEnd'))      dto.intakeWindowEnd      = values.intakeWindowEnd?.toISOString()   ?? null;
    if (form.isDirty('budgetCycleStart'))     dto.budgetCycleStart     = values.budgetCycleStart?.toISOString()  ?? null;
    if (form.isDirty('budgetCycleEnd'))       dto.budgetCycleEnd       = values.budgetCycleEnd?.toISOString()    ?? null;
    if (form.isDirty('gxpItValidationDays'))  dto.gxpItValidationDays  = values.gxpItValidationDays;
    if (form.isDirty('gxpDocumentationDays')) dto.gxpDocumentationDays = values.gxpDocumentationDays;

    if (Object.keys(dto).length === 0) {
      notifications.show({ color: 'blue', message: 'No changes to save' });
      return;
    }

    update(dto, {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Configuration saved' });
        form.resetDirty();
      },
      onError: () => {
        notifications.show({ color: 'red', message: 'Failed to save configuration — please try again' });
      },
    });
  }

  if (isPending) {
    return (
      <PageLayout>
        <Stack gap="md">
          <PageHeader title="System Configuration" icon={<IconSettings size={22} />} />
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}
        </Stack>
      </PageLayout>
    );
  }

  if (isError) {
    return (
      <PageLayout>
        <Stack gap="md">
          <PageHeader title="System Configuration" icon={<IconSettings size={22} />} />
          <Alert color="stadaRed" title="Failed to load configuration">
            <Button variant="subtle" size="compact-sm" onClick={() => void refetch()}>Retry</Button>
          </Alert>
        </Stack>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
    <Stack gap="md" maw={640}>
      <PageHeader title="System Configuration" icon={<IconSettings size={22} />} />

      <form onSubmit={form.onSubmit(handleSave)}>
        <Stack gap="xl">

          {/* SP Threshold */}
          <div>
            <Text fw={600} mb="xs">SP Threshold</Text>
            <Divider mb="sm" />
            <NumberInput
              label="SP Threshold (€)"
              description="Demands at or below this amount are classified as Small Projects"
              min={1}
              allowDecimal={false}
              {...form.getInputProps('spThresholdEuros')}
            />
          </div>

          {/* Intake Window */}
          <div>
            <Text fw={600} mb="xs">Intake Window</Text>
            <Divider mb="sm" />
            <Text size="sm" c="dimmed" mb="sm">Leave blank to keep intake always open</Text>
            <Group grow>
              <DatePickerInput
                label="Window Opens"
                placeholder="Always open"
                clearable
                {...form.getInputProps('intakeWindowStart')}
              />
              <DatePickerInput
                label="Window Closes"
                placeholder="Always open"
                clearable
                {...form.getInputProps('intakeWindowEnd')}
              />
            </Group>
          </div>

          {/* Budget Cycle */}
          <div>
            <Text fw={600} mb="xs">Budget Cycle</Text>
            <Divider mb="sm" />
            <Group grow>
              <DatePickerInput
                label="Cycle Start"
                placeholder="Not set"
                clearable
                {...form.getInputProps('budgetCycleStart')}
              />
              <DatePickerInput
                label="Cycle End"
                placeholder="Not set"
                clearable
                {...form.getInputProps('budgetCycleEnd')}
              />
            </Group>
          </div>

          {/* GxP Milestone Defaults */}
          <div>
            <Text fw={600} mb="xs">GxP Milestone Defaults</Text>
            <Divider mb="sm" />
            <Group grow>
              <NumberInput
                label="IT Validation (days)"
                min={1}
                allowDecimal={false}
                {...form.getInputProps('gxpItValidationDays')}
              />
              <NumberInput
                label="Documentation (days)"
                min={1}
                allowDecimal={false}
                {...form.getInputProps('gxpDocumentationDays')}
              />
            </Group>
          </div>

          <Group justify="flex-end">
            <Button
              type="submit"
              color="stadaRed"
              loading={isSaving}
              disabled={isSaving}
            >
              Save Configuration
            </Button>
          </Group>

        </Stack>
      </form>
    </Stack>
    </PageLayout>
  );
}
