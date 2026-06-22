import { Accordion, Badge, Group, Stack, Text } from '@mantine/core';
import { StatusReportItem, RagValue } from '../api/execution.api';

const RAG_COLOR: Record<string, string> = { GREEN: 'teal', AMBER: 'orange', RED: 'red' };
const RAG_LABEL: Record<string, string> = { GREEN: 'Green', AMBER: 'Amber', RED: 'Red' };

function RagBadge({ rag }: { rag: string }) {
  return <Badge color={RAG_COLOR[rag] ?? 'gray'} size="sm">{RAG_LABEL[rag] ?? rag}</Badge>;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const RAG_FIELDS: { key: keyof StatusReportItem; label: string; explanationKey: keyof StatusReportItem }[] = [
  { key: 'overallRag',        label: 'Overall',           explanationKey: 'overallExplanation' },
  { key: 'scheduleRag',       label: 'Schedule',          explanationKey: 'scheduleExplanation' },
  { key: 'resourcesRag',      label: 'Resources',         explanationKey: 'resourcesExplanation' },
  { key: 'budgetCurrentRag',  label: 'Budget (Current)',  explanationKey: 'budgetCurrentExplanation' },
  { key: 'budgetForecastRag', label: 'Budget (Forecast)', explanationKey: 'budgetForecastExplanation' },
  { key: 'stakeholdersRag',   label: 'Stakeholders',      explanationKey: 'stakeholdersExplanation' },
  { key: 'valuePropRag',      label: 'Value Proposition', explanationKey: 'valuePropExplanation' },
  { key: 'providerRag',       label: 'Provider',          explanationKey: 'providerExplanation' },
];

function deltaIndicator(current: RagValue | null, previous: RagValue | null): string | null {
  if (!current || !previous || current === previous) return null;
  const rank: Record<RagValue, number> = { GREEN: 0, AMBER: 1, RED: 2 };
  return rank[current] < rank[previous] ? '↑' : '↓';
}

interface Props {
  reports: StatusReportItem[];
}

export function StatusReportHistoryPanel({ reports }: Props) {
  if (reports.length === 0) {
    return <Text size="sm" c="dimmed">No status reports yet.</Text>;
  }

  return (
    <Accordion variant="separated" radius="md">
      {reports.map((report, i) => {
        const prev = reports[i + 1] ?? null;

        return (
          <Accordion.Item key={report.id} value={report.id}>
            <Accordion.Control>
              <Group gap="xs" wrap="wrap">
                <Text size="sm" fw={500}>{fmtDate(report.submittedAt)}</Text>
                <RagBadge rag={report.overallRag} />
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {RAG_FIELDS.map(({ key, label, explanationKey }) => {
                  const rag = (report[key] as RagValue | null) ?? null;
                  const explanation = report[explanationKey] as string | null;
                  const delta = prev ? deltaIndicator(rag, (prev[key] as RagValue | null) ?? null) : null;

                  return (
                    <Stack key={key} gap={2}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>{label}</Text>
                        {rag ? (
                          <RagBadge rag={rag} />
                        ) : (
                          <Text size="xs" c="dimmed">—</Text>
                        )}
                        {delta && (
                          <Text size="xs" c={delta === '↑' ? 'teal' : 'red'} fw={600}>{delta}</Text>
                        )}
                      </Group>
                      {rag && rag !== 'GREEN' && explanation && (
                        <Text size="xs" c="dimmed" pl="sm">{explanation}</Text>
                      )}
                    </Stack>
                  );
                })}

                {report.keyAccomplishments && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>Key Accomplishments</Text>
                    <Text size="xs">{report.keyAccomplishments}</Text>
                  </Stack>
                )}

                {report.nextSteps && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>Next Steps</Text>
                    <Text size="xs">{report.nextSteps}</Text>
                  </Stack>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
