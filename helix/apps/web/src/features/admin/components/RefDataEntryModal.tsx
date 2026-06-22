import { useEffect } from 'react';
import { Modal, TextInput, Checkbox, Select, MultiSelect, Button, Group, Alert, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldDescriptor {
  key: string;
  label: string;
  type: 'text' | 'checkbox' | 'select' | 'multiselect';
  required?: boolean;
  options?: SelectOption[];
}

export type FormValues = Record<string, string | boolean | string[]>;

interface Props {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
  isPending: boolean;
  fields: FieldDescriptor[];
  initialValues?: FormValues;
  title: string;
  apiError?: string | null;
}

export function RefDataEntryModal({
  opened,
  onClose,
  onSubmit,
  isPending,
  fields,
  initialValues,
  title,
  apiError,
}: Props): JSX.Element {
  const defaultValues: FormValues = {};
  for (const f of fields) {
    if (f.type === 'checkbox') defaultValues[f.key] = false;
    else if (f.type === 'multiselect') defaultValues[f.key] = [];
    else defaultValues[f.key] = '';
  }

  const form = useForm<FormValues>({
    initialValues: initialValues ?? defaultValues,
    validate: Object.fromEntries(
      fields
        .filter((f) => f.required !== false && (f.type === 'text' || f.type === 'select' || f.type === 'multiselect'))
        .map((f) => [
          f.key,
          (v: string | boolean | string[]) => {
            if (f.type === 'multiselect') {
              return Array.isArray(v) && v.length === 0 ? `${f.label} is required` : null;
            }
            return typeof v === 'string' && v.trim().length === 0 ? `${f.label} is required` : null;
          },
        ]),
    ),
  });

  useEffect(() => {
    if (opened) {
      const defaults: FormValues = {};
      for (const f of fields) {
        if (f.type === 'checkbox') defaults[f.key] = false;
        else if (f.type === 'multiselect') defaults[f.key] = [];
        else defaults[f.key] = '';
      }
      form.initialize(initialValues ?? defaults);
    }
  // form and fields are stable refs (useForm + module-level constant at all call sites)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, initialValues]);

  function handleClose() {
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title={title} size="sm">
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="sm">
          {fields.map((f) =>
            f.type === 'checkbox' ? (
              <Checkbox
                key={f.key}
                label={f.label}
                checked={form.values[f.key] as boolean}
                onChange={(e) => form.setFieldValue(f.key, e.currentTarget.checked)}
              />
            ) : f.type === 'select' ? (
              <Select
                key={f.key}
                label={f.label}
                data={f.options ?? []}
                required={f.required !== false}
                {...form.getInputProps(f.key)}
              />
            ) : f.type === 'multiselect' ? (
              <MultiSelect
                key={f.key}
                label={f.label}
                data={f.options ?? []}
                required={f.required !== false}
                {...form.getInputProps(f.key)}
              />
            ) : (
              <TextInput
                key={f.key}
                label={f.label}
                required={f.required !== false}
                {...form.getInputProps(f.key)}
              />
            ),
          )}

          {apiError && <Alert color="stadaRed">{apiError}</Alert>}

          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" color="stadaRed" loading={isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function getBlockers(err: unknown): { id: string; title: string; status: string }[] {
  const data = (err as { response?: { data?: { blockers?: { id: string; title: string; status: string }[] } } })
    ?.response?.data;
  return data?.blockers ?? [];
}

export function isConflictError(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 409;
}

export function isBlockersError(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 422;
}
