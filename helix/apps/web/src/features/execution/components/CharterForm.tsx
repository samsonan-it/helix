import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { submitCharterValidationSchema } from '@helix/shared';
import { type ProjectDetail as ProjectDetailType } from '../api/execution.api';
import { useUpdateCharter } from '../hooks/useUpdateCharter';
import { useSubmitCharter } from '../hooks/useSubmitCharter';

interface Props {
  project: ProjectDetailType;
  isEditable: boolean;
}

type BoolField =
  | 'gxpRelevant'
  | 'icRecharge'
  | 'icRechargeAlignmentConducted'
  | 'eaAlignmentConducted'
  | 'itSecurityAlignmentConducted'
  | 'licensesNeeded'
  | 'qualitativeValue'
  | 'quantitativeValue';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {value != null && value !== '' ? String(value) : '—'}
      </Text>
    </Stack>
  );
}

function BoolField({ label, value }: { label: string; value: boolean | null }) {
  return <Field label={label} value={value === true ? 'Yes' : value === false ? 'No' : null} />;
}

function eur(cents: number | null | undefined): string | null {
  return cents != null ? (cents / 100).toFixed(2) : null;
}

export function CharterForm({ project, isEditable }: Props) {
  const { mutate: save, isPending: isSaving } = useUpdateCharter(project.id);
  const { mutate: submit, isPending: isSubmitting, error: submitError } = useSubmitCharter(project.id);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bools, setBools] = useState<Record<BoolField, boolean | null>>({
    gxpRelevant: project.gxpRelevant,
    icRecharge: project.icRecharge,
    icRechargeAlignmentConducted: project.icRechargeAlignmentConducted,
    eaAlignmentConducted: project.eaAlignmentConducted,
    itSecurityAlignmentConducted: project.itSecurityAlignmentConducted,
    licensesNeeded: project.licensesNeeded,
    qualitativeValue: project.qualitativeValue,
    quantitativeValue: project.quantitativeValue,
  });
  const [licenseInBudgetSeg, setLicenseInBudgetSeg] = useState<'yes' | 'no' | ''>(
    () => project.licenseInBudget === true ? 'yes' : project.licenseInBudget === false ? 'no' : '',
  );
  const [licenseMetricLocal, setLicenseMetricLocal] = useState<string | null>(project.licenseMetric ?? null);

  const isPendingApproval = project.status === 'PENDING_APPROVAL';
  const readonly = !isEditable || isPendingApproval;

  // Required booleans now render as toggles, which have no "unset" state. Persist an explicit
  // `false` for any that are still null so the visible toggle matches the saved value and the
  // submit validation (which rejects null) is satisfiable.
  useEffect(() => {
    if (readonly) return;
    const patch: Partial<Record<BoolField, boolean>> = {};
    if (project.icRecharge == null) patch.icRecharge = false;
    if (project.eaAlignmentConducted == null) patch.eaAlignmentConducted = false;
    if (project.itSecurityAlignmentConducted == null) patch.itSecurityAlignmentConducted = false;
    if (project.licensesNeeded == null) patch.licensesNeeded = false;
    if (Object.keys(patch).length > 0) {
      setBools((prev) => ({ ...prev, ...patch }));
      save(patch);
    }
  }, []);

  function onBlurText(field: string, value: string) {
    save({ [field]: value.trim() || null });
  }

  function onBlurCents(field: string, euros: number | string) {
    const num = typeof euros === 'number' ? euros : parseFloat(String(euros));
    save({ [field]: isNaN(num) ? null : Math.round(num * 100) });
  }

  function onToggle(field: BoolField, checked: boolean) {
    if (field === 'icRecharge' && !checked) {
      setBools((prev) => ({ ...prev, icRecharge: false, icRechargeAlignmentConducted: false }));
      save({ icRecharge: false, icRechargeAlignmentConducted: false });
      return;
    }
    setBools((prev) => ({ ...prev, [field]: checked }));
    save({ [field]: checked });
  }

  function onChangeInt(field: string, val: number | string) {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    save({ [field]: isNaN(num) ? null : num });
  }

  const RENDERED_FIELDS = new Set([
    'objective', 'necessity', 'scope', 'depsAssumptionsRisk', 'appPlatformOwner',
    'businessPm', 'businessSponsor', 'icRecharge', 'icRechargeAlignmentConducted',
    'archImpact', 'eaAlignmentConducted', 'itSecurityAlignmentConducted',
    'maintenanceL1', 'maintenanceL2', 'maintenanceL3', 'licensesNeeded',
    'licenseCostCents', 'licenseExpectedUsers', 'licenseMetric', 'licenseInBudget',
    'qualitativeValue', 'quantitativeValue', 'valueCaseDescription',
  ]);

  function handleSubmit() {
    setSubmitAttempted(true);
    const projectForValidation = {
      ...project,
      ...bools,
      eaComment: project.eaComment?.trim() || null,
      itSecurityComment: project.itSecurityComment?.trim() || null,
    };
    const clientValidation = submitCharterValidationSchema.safeParse(projectForValidation);
    if (!clientValidation.success) {
      const mapped: Record<string, string> = {};
      for (const [k, msgs] of Object.entries(clientValidation.error.flatten().fieldErrors)) {
        mapped[k] = Array.isArray(msgs) ? msgs[0] : String(msgs);
      }
      const orphanKeys = Object.keys(mapped).filter((k) => !RENDERED_FIELDS.has(k));
      if (orphanKeys.length > 0) {
        mapped['_orphan'] = 'Some required fields could not be validated. Please contact support.';
      }
      setFieldErrors(mapped);
      return;
    }
    setFieldErrors({});
    submit(undefined, {
      onError: (err: unknown) => {
        const body = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data;
        if (body?.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, msgs] of Object.entries(body.errors)) {
            mapped[k] = Array.isArray(msgs) ? msgs[0] : String(msgs);
          }
          setFieldErrors(mapped);
        }
      },
    });
  }

  // ── Read-only ──────────────────────────────────────────────────────────────
  if (readonly) {
    const roShowValueCaseDescription =
      project.qualitativeValue === true || project.quantitativeValue === true;

    const longFields = [
      { label: 'Project objective', value: project.objective },
      { label: 'Necessity', value: project.necessity },
      { label: 'Scope', value: project.scope },
      { label: 'Dependencies / Assumptions / Risk', value: project.depsAssumptionsRisk },
      { label: 'Impact on Existing Architecture', value: project.archImpact },
      ...(roShowValueCaseDescription
        ? [{ label: 'Value Case Description', value: project.valueCaseDescription }]
        : []),
    ];

    return (
      <Stack gap="md">
        {isPendingApproval && (
          <Alert color="blue" title="Submitted — awaiting approval">
            Awaiting Portfolio Manager approval
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {longFields.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} />
          ))}
        </SimpleGrid>

        <Divider />

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          <Field label="System Owner" value={project.appPlatformOwner} />
          <Field label="Business PM" value={project.businessPm} />
          <Field label="IT PM (Assigned)" value={project.assignedPmName} />
          <Field label="Business Sponsor" value={project.businessSponsor} />
          <BoolField label="GxP Relevant" value={project.gxpRelevant} />
          <BoolField label="IC Recharge" value={project.icRecharge} />
          {project.icRecharge === true && (
            <BoolField label="IC Recharge Alignment Conducted" value={project.icRechargeAlignmentConducted} />
          )}
          <BoolField label="EA Alignment Conducted" value={project.eaAlignmentConducted} />
          <BoolField label="IT Security Alignment Conducted" value={project.itSecurityAlignmentConducted} />
        </SimpleGrid>

        <Divider label="Maintenance / Support" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Field label="L1" value={project.maintenanceL1} />
          <Field label="L2" value={project.maintenanceL2} />
          <Field label="L3" value={project.maintenanceL3} />
        </SimpleGrid>

        <Divider label="Licenses" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          <BoolField label="Post Go-Live Licenses" value={project.licensesNeeded} />
          {project.licensesNeeded && (
            <>
              <Field label="License Cost Amount (EUR)" value={eur(project.licenseCostCents)} />
              <Field label="Expected Number of New Users" value={project.licenseExpectedUsers} />
              <Field
                label="License Metric"
                value={project.licenseMetric
                  ? ({ per_user: 'Per User', per_transaction: 'Per Transaction', other: 'Other' }[project.licenseMetric] ?? project.licenseMetric)
                  : null}
              />
              <BoolField label="Included in Budget" value={project.licenseInBudget} />
            </>
          )}
        </SimpleGrid>

        <Divider label="Value Cases" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          <BoolField label="Qualitative Value" value={project.qualitativeValue} />
          <BoolField label="Quantitative Value" value={project.quantitativeValue} />
        </SimpleGrid>
      </Stack>
    );
  }

  // ── Editable ───────────────────────────────────────────────────────────────
  const showValueCaseDescription = bools.qualitativeValue === true || bools.quantitativeValue === true;

  const Toggle = ({ field, label, required }: { field: BoolField; label: string; required?: boolean }) => (
    <Stack gap={2}>
      <Switch
        label={
          <Text size="sm" fw={500} span>
            {label}{required && <Text span c="red"> *</Text>}
          </Text>
        }
        checked={bools[field] ?? false}
        onChange={(e) => onToggle(field, e.currentTarget.checked)}
      />
      {required && submitAttempted && fieldErrors[field] && (
        <Text size="xs" c="red">{fieldErrors[field]}</Text>
      )}
    </Stack>
  );

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed" style={{ visibility: isSaving ? 'visible' : 'hidden' }}>Saving…</Text>

      <Textarea
        label="Project objective"
        required
        error={submitAttempted ? fieldErrors.objective : undefined}
        defaultValue={project.objective ?? ''}
        onBlur={(e) => onBlurText('objective', e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={10}
      />
      <Textarea
        label="Necessity"
        required
        error={submitAttempted ? fieldErrors.necessity : undefined}
        defaultValue={project.necessity ?? ''}
        onBlur={(e) => onBlurText('necessity', e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={10}
      />
      <Textarea
        label="Scope"
        required
        error={submitAttempted ? fieldErrors.scope : undefined}
        defaultValue={project.scope ?? ''}
        onBlur={(e) => onBlurText('scope', e.currentTarget.value)}
        autosize
        minRows={3}
        maxRows={10}
      />
      <Textarea
        label="Dependencies / Assumptions / Risk"
        required
        error={submitAttempted ? fieldErrors.depsAssumptionsRisk : undefined}
        defaultValue={project.depsAssumptionsRisk ?? ''}
        onBlur={(e) => onBlurText('depsAssumptionsRisk', e.currentTarget.value)}
        autosize
        minRows={3}
        maxRows={10}
        /* TODO: AI-assist for Deps/Risk — Story 2.7 DIAL adapter required */
      />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <TextInput
          label="System Owner"
          required
          error={submitAttempted ? fieldErrors.appPlatformOwner : undefined}
          defaultValue={project.appPlatformOwner ?? ''}
          onBlur={(e) => onBlurText('appPlatformOwner', e.currentTarget.value)}
        />
        <TextInput
          label="Business Sponsor"
          required
          error={submitAttempted ? fieldErrors.businessSponsor : undefined}
          defaultValue={project.businessSponsor ?? ''}
          onBlur={(e) => onBlurText('businessSponsor', e.currentTarget.value)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <TextInput
          label="Business PM"
          required
          error={submitAttempted ? fieldErrors.businessPm : undefined}
          defaultValue={project.businessPm ?? ''}
          onBlur={(e) => onBlurText('businessPm', e.currentTarget.value)}
        />
        <TextInput
          label="IT PM (Assigned)"
          value={project.assignedPmName ?? ''}
          disabled
        />
      </SimpleGrid>

      <Toggle field="gxpRelevant" label="GxP Relevant" />

      <Toggle field="icRecharge" label="IC Recharge" />
      {bools.icRecharge === true && (
        <Toggle field="icRechargeAlignmentConducted" label="IC Recharge Alignment Conducted" required />
      )}

      <Textarea
        label="Impact on Existing Architecture"
        required
        error={submitAttempted ? fieldErrors.archImpact : undefined}
        defaultValue={project.archImpact ?? ''}
        onBlur={(e) => onBlurText('archImpact', e.currentTarget.value)}
        autosize
        minRows={3}
        maxRows={10}
      />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Toggle field="eaAlignmentConducted" label="EA Alignment Conducted" required />
        <Toggle field="itSecurityAlignmentConducted" label="IT Security Alignment Conducted" required />
      </SimpleGrid>

      <Divider label="Maintenance / Support" labelPosition="left" />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <TextInput
          label="L1"
          required
          error={submitAttempted ? fieldErrors.maintenanceL1 : undefined}
          defaultValue={project.maintenanceL1 ?? ''}
          onBlur={(e) => onBlurText('maintenanceL1', e.currentTarget.value)}
        />
        <TextInput
          label="L2"
          required
          error={submitAttempted ? fieldErrors.maintenanceL2 : undefined}
          defaultValue={project.maintenanceL2 ?? ''}
          onBlur={(e) => onBlurText('maintenanceL2', e.currentTarget.value)}
        />
        <TextInput
          label="L3"
          required
          error={submitAttempted ? fieldErrors.maintenanceL3 : undefined}
          defaultValue={project.maintenanceL3 ?? ''}
          onBlur={(e) => onBlurText('maintenanceL3', e.currentTarget.value)}
        />
      </SimpleGrid>

      <Divider label="Licenses" labelPosition="left" />
      <Toggle field="licensesNeeded" label="Post Go-Live Licenses" required />

      {bools.licensesNeeded === true && (
        <Box
          style={{
            borderLeft: '2px solid var(--mantine-color-blue-3)',
            paddingLeft: 'var(--mantine-spacing-md)',
          }}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <NumberInput
                label="License Cost Amount (EUR)"
                required
                error={submitAttempted ? fieldErrors.licenseCostCents : undefined}
                defaultValue={project.licenseCostCents != null ? project.licenseCostCents / 100 : undefined}
                decimalScale={2}
                onBlur={(e) => onBlurCents('licenseCostCents', e.currentTarget.value)}
                min={0}
              />
              <NumberInput
                label="Expected Number of New Users"
                required
                error={submitAttempted ? fieldErrors.licenseExpectedUsers : undefined}
                defaultValue={project.licenseExpectedUsers ?? undefined}
                onBlur={(e) => onChangeInt('licenseExpectedUsers', e.currentTarget.value)}
                min={0}
                allowDecimal={false}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Stack gap="xs">
                <Select
                  label="License Metric"
                  required
                  error={submitAttempted ? fieldErrors.licenseMetric : undefined}
                  value={licenseMetricLocal}
                  onChange={(val) => {
                    setLicenseMetricLocal(val);
                    save({ licenseMetric: val ?? null });
                  }}
                  data={[
                    { label: 'Per User', value: 'per_user' },
                    { label: 'Per Transaction', value: 'per_transaction' },
                    { label: 'Other', value: 'other' },
                  ]}
                />
                {licenseMetricLocal === 'per_user' &&
                  project.licenseCostCents != null &&
                  project.licenseExpectedUsers != null && (
                  <Text size="sm" c="dimmed">
                    Total License Amount: €{((project.licenseCostCents / 100) * project.licenseExpectedUsers).toFixed(2)}
                  </Text>
                )}
              </Stack>
              <Stack gap={2}>
                <Text size="sm" fw={500}>Included in Budget <Text span c="red">*</Text></Text>
                <SegmentedControl
                  value={licenseInBudgetSeg}
                  onChange={(val) => {
                    const v = val as 'yes' | 'no';
                    setLicenseInBudgetSeg(v);
                    save({ licenseInBudget: v === 'yes' });
                  }}
                  data={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]}
                />
                {submitAttempted && fieldErrors.licenseInBudget && (
                  <Text size="xs" c="red">{fieldErrors.licenseInBudget}</Text>
                )}
              </Stack>
            </SimpleGrid>
          </Stack>
        </Box>
      )}

      <Divider label="Value Cases" labelPosition="left" />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Toggle field="qualitativeValue" label="Qualitative Value" />
        <Toggle field="quantitativeValue" label="Quantitative Value" />
      </SimpleGrid>

      {showValueCaseDescription && (
        <Textarea
          label="Value Case Description"
          required
          error={submitAttempted ? fieldErrors.valueCaseDescription : undefined}
          defaultValue={project.valueCaseDescription ?? ''}
          onBlur={(e) => onBlurText('valueCaseDescription', e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={10}
        />
      )}

      {fieldErrors['_orphan'] && (
        <Alert color="stadaRed" title="Submission failed">
          {fieldErrors['_orphan']}
        </Alert>
      )}
      {submitError && !Object.keys(fieldErrors).length && (
        <Alert color="stadaRed" title="Submission failed">
          {(submitError as { message?: string })?.message ?? 'An error occurred. Please try again.'}
        </Alert>
      )}

      {project.status === 'DRAFT' && (
        <Group justify="flex-end">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isSaving}
            loading={isSubmitting}
          >
            Submit for Approval
          </Button>
        </Group>
      )}
    </Stack>
  );
}
