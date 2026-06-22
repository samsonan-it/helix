import { SimpleGrid, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { DemandResponse } from '@helix/shared';
import { useGetAreas, useGetCostCentres, useGetLegalEntities } from './intake.queries';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Text size="sm">{value}</Text>
    </Stack>
  );
}

function BoolField({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value == null) return null;
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Text size="sm">{value ? 'Yes' : 'No'}</Text>
    </Stack>
  );
}

interface Props {
  demand: DemandResponse;
}

export function DemandReadOnlyFields({ demand }: Props) {
  const { data: costCentres = [] } = useGetCostCentres();
  const { data: legalEntities = [] } = useGetLegalEntities();
  const { data: areas = [] } = useGetAreas();

  const costCentreName = demand.costCentre?.name
    ?? costCentres.find(c => c.id === demand.costCentreId)?.name
    ?? (demand.costCentreId ? '[Inactive]' : undefined);
  const legalEntityName = demand.legalEntity?.name
    ?? legalEntities.find(le => le.id === demand.legalEntityId)?.name
    ?? (demand.legalEntityId ? '[Inactive]' : undefined);
  const areaBaseName = demand.area?.name
    ?? areas.find(a => a.id === demand.areaId)?.name
    ?? (demand.areaId ? '[Inactive]' : undefined);
  const scopeSuffix = demand.demandScope === 'GLOBAL'
    ? 'Global'
    : demand.demandScope === 'LOCAL'
      ? (demand.country?.name ?? null)
      : null;
  const areaName = areaBaseName && scopeSuffix
    ? `${areaBaseName} - ${scopeSuffix}`
    : areaBaseName;

  const fmt = (d: string | null | undefined) => d ? dayjs(d).format('DD MMM YYYY') : null;

  const longFields = [
    { label: 'Objective', value: demand.objective },
    { label: 'Necessity', value: demand.necessity },
    { label: 'As-Is Description', value: demand.asisDescription },
    { label: 'To-Be Description', value: demand.tobeDescription },
    { label: 'Benefits', value: demand.benefitsObjectives },
    ...(demand.isMandatory && demand.reasoningForMandatory
      ? [{ label: 'Reasoning for Mandatory', value: demand.reasoningForMandatory }]
      : []),
  ].filter(f => f.value);

  return (
    <Stack gap="sm">
      <SimpleGrid cols={3} spacing="sm">
        <Field label="Cost Centre" value={costCentreName} />
        <Field label="Legal Entity" value={legalEntityName} />
        <Field label="Area" value={areaName} />
        <Field label="Demand Owner" value={demand.demandOwner} />
        <Field label="Start Date" value={fmt(demand.startDate)} />
        <Field label="End Date" value={fmt(demand.endDate)} />
        <Field label="Submitted" value={fmt(demand.submittedAt)} />
        <BoolField label="Mandatory" value={demand.isMandatory} />
        <BoolField label="GxP Relevant" value={demand.isGxpRelevant} />
        <BoolField label="Qualitative Value" value={demand.qualitativeValueCategory} />
        <BoolField label="Quantitative Value" value={demand.quantitativeValueCategory} />

      </SimpleGrid>
      {longFields.length > 0 && (
        <SimpleGrid cols={2} spacing="sm">
          {longFields.map(f => (
            <Stack key={f.label} gap={2}>
              <Text size="xs" c="dimmed" fw={500}>{f.label}</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{f.value}</Text>
            </Stack>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
