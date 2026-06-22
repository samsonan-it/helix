import { Link, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useRef, useState } from 'react';
import { DemandResponse, DemandStatus, FinancialPlanResponse } from '@helix/shared';
import { Role } from '@helix/types';
import { IconTable } from '@tabler/icons-react';
import { useAuthStore } from '../../stores/auth.store';
import { DemandStatusBadge } from '../../components/DemandStatusBadge';
import { DemandTypeIndicator } from '../../components/DemandTypeIndicator';
import { CopyLinkButton } from '../../components/CopyLinkButton';
import { StatusStepper, formatActor } from '../../components/StatusStepper';
import { DemandHistoryList } from '../workflow/components/DemandHistoryList';
import { FinancialPlanModal } from '../workflow/components/FinancialPlanModal';
import { useSpAcceptOffer, useSpReworkOffer } from '../workflow/hooks/useSpActions';
import { useGetFinancialPlan, useGetPersons, useGetBcsByArea } from './intake.queries';
import { DemandReadOnlyFields } from './DemandReadOnlyFields';
import { PageLayout } from '../../components/PageLayout';

const DETAIL_STEPS = [
  { label: 'Submitted' },
  { label: 'DM Review' },
  { label: 'Business Controller' },
  { label: 'Portfolio Manager' },
  { label: 'Approved' },
];

const SP_DETAIL_STEPS = [
  { label: 'Requester' },
  { label: 'DM — Review & Estimate' },
  { label: 'Requester' },
  { label: 'Portfolio Manager' },
];

interface StepperProps {
  activeStep: number;
  currentActor: string;
  nextActor: string;
  steps: { label: string }[];
}

function deriveStepperProps(demand: DemandResponse, dmName: string, bcName: string): StepperProps {
  if (demand.isSmallProject) {
    switch (demand.status) {
      case DemandStatus.SUBMITTED:
      case DemandStatus.REROUTED:
        return { activeStep: 1, currentActor: dmName, nextActor: 'Originator', steps: SP_DETAIL_STEPS };
      case DemandStatus.SP_OFFER_REVIEW:
        return { activeStep: 2, currentActor: 'Originator', nextActor: 'Portfolio Manager', steps: SP_DETAIL_STEPS };
      case DemandStatus.IN_REVIEW:
        return { activeStep: 3, currentActor: 'Portfolio Manager', nextActor: '—', steps: SP_DETAIL_STEPS };
      case DemandStatus.APPROVED:
      case DemandStatus.IN_EXECUTION:
      case DemandStatus.COMPLETED:
        return { activeStep: SP_DETAIL_STEPS.length, currentActor: 'Approved', nextActor: '—', steps: SP_DETAIL_STEPS };
      default:
        return { activeStep: 0, currentActor: '—', nextActor: '—', steps: SP_DETAIL_STEPS };
    }
  }
  switch (demand.status) {
    case DemandStatus.SUBMITTED:
      return { activeStep: 1, currentActor: dmName, nextActor: bcName, steps: DETAIL_STEPS };
    case DemandStatus.BC_REVIEW:
      return { activeStep: 2, currentActor: bcName, nextActor: 'Portfolio Manager', steps: DETAIL_STEPS };
    case DemandStatus.IN_REVIEW:
      return { activeStep: 3, currentActor: 'Portfolio Manager', nextActor: '—', steps: DETAIL_STEPS };
    case DemandStatus.REROUTED:
      return demand.bcActionedBy
        ? { activeStep: 2, currentActor: bcName, nextActor: 'Originator', steps: DETAIL_STEPS }
        : { activeStep: 1, currentActor: dmName, nextActor: 'Originator', steps: DETAIL_STEPS };
    case DemandStatus.REJECTED:
      if (demand.pmActionedBy) return { activeStep: 3, currentActor: 'Portfolio Manager', nextActor: '—', steps: DETAIL_STEPS };
      if (demand.bcActionedBy) return { activeStep: 2, currentActor: bcName, nextActor: '—', steps: DETAIL_STEPS };
      return { activeStep: 1, currentActor: dmName, nextActor: '—', steps: DETAIL_STEPS };
    case DemandStatus.ON_HOLD:
      return { activeStep: 1, currentActor: dmName, nextActor: '—', steps: DETAIL_STEPS };
    case DemandStatus.APPROVED:
    case DemandStatus.IN_EXECUTION:
    case DemandStatus.COMPLETED:
      return { activeStep: DETAIL_STEPS.length, currentActor: 'Approved', nextActor: '—', steps: DETAIL_STEPS };
    case DemandStatus.CANCELLED:
      return { activeStep: 0, currentActor: '—', nextActor: '—', steps: DETAIL_STEPS };
    default:
      return { activeStep: 0, currentActor: '—', nextActor: '—', steps: DETAIL_STEPS };
  }
}

function formatEuros(cents: number): string {
  return `€${(cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sumPlan(plan: FinancialPlanResponse | undefined): { totalOpex: number; totalCapex: number } {
  if (!plan) return { totalOpex: 0, totalCapex: 0 };
  return plan.entries.reduce(
    (acc, e) => ({
      totalOpex:  acc.totalOpex  + (e.category === 'opex'  ? e.valueCents : 0),
      totalCapex: acc.totalCapex + (e.category === 'capex' ? e.valueCents : 0),
    }),
    { totalOpex: 0, totalCapex: 0 },
  );
}

function FinancialField({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
      <Text size="sm">{value}</Text>
    </Stack>
  );
}

interface Props {
  demand: DemandResponse;
}

export function DemandDetailPage({ demand }: Props) {
  const [searchParams] = useSearchParams();
  const isReviewView = searchParams.get('view') === 'review';
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isReviewView && reviewSectionRef.current) {
      reviewSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isReviewView]);

  const currentUser = useAuthStore(s => s.user);
  const isRequester = currentUser?.roles.includes(Role.DemandRequester) ?? false;
  const { data: persons = [] } = useGetPersons();
  const { data: bcPersons = [] } = useGetBcsByArea(demand.areaId ?? undefined);
  const { data: financialPlan, isLoading: planLoading } = useGetFinancialPlan(demand.id);
  const [finPlanOpened, { open: openFinPlan, close: closeFinPlan }] = useDisclosure(false);

  const isSpOfferReview =
    demand.isSmallProject &&
    demand.status === DemandStatus.SP_OFFER_REVIEW;
  const spAcceptOfferMutation = useSpAcceptOffer(demand.id);
  const spReworkOfferMutation = useSpReworkOffer(demand.id);
  const [offerReworkDrawerOpen, setOfferReworkDrawerOpen] = useState(false);
  const [offerReworkComment, setOfferReworkComment] = useState('');

  const handleSpAcceptOffer = () => {
    spAcceptOfferMutation.mutate(undefined);
  };

  const dmActor = formatActor('Demand Manager', persons.find(p => p.id === demand.demandManagerId)?.name);
  const bcActor = formatActor('Business Controller', bcPersons.find(p => p.id === demand.businessControllerId)?.name);
  const { activeStep, currentActor, nextActor, steps } = deriveStepperProps(demand, dmActor, bcActor);

  const { totalOpex, totalCapex } = sumPlan(financialPlan);

  const fmtDateTime = (d: string | null | undefined) =>
    d ? dayjs(d).format('DD MMM YYYY HH:mm') : null;

  return (
    <PageLayout>
      <Box maw={860} mx="auto" pt="xl">
      {/* Header — on canvas */}
      <div>
        <Anchor component={Link} to="/demands" size="sm" c="dimmed" mb="md" display="block">
          ← Back to My Demands
        </Anchor>
        <Text size="sm" c="dimmed" mb={6}>#{demand.publicId}</Text>
        <Group gap="sm" align="center" wrap="wrap">
          <Title order={1}>{demand.title}</Title>
          <DemandStatusBadge status={demand.status} />
          <DemandTypeIndicator type={demand.projectType} />
          <CopyLinkButton />
        </Group>
        {demand.projectId && (
          <Anchor component={Link} to={`/projects?id=${demand.projectId}`} size="sm" mt={4} display="inline-block">
            View Project →
          </Anchor>
        )}
      </div>

      {/* Status Stepper — on canvas */}
      <div style={{ marginTop: 'var(--mantine-spacing-xl)' }}>
        <StatusStepper
          status={demand.status}
          currentActor={currentActor}
          nextActor={nextActor}
          steps={steps}
          activeStep={activeStep}
        />
      </div>

      {/* Card stack */}
      <Stack gap="lg" mt="lg">
        {/* Main card */}
        <Card withBorder shadow="sm" radius="lg" p="xl">
          <Stack gap="lg">
            {/* Demand details */}
            <div>
              {demand.description && (
                <Text size="sm" c="dimmed" mb="sm">{demand.description}</Text>
              )}
              <DemandReadOnlyFields demand={demand} />
              {(demand.qualitativeValueCategory != null || demand.quantitativeValueCategory != null) && (
                <Stack gap="xs" mt="xs">
                  {demand.qualitativeValueCategory != null && (
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed" fw={500}>Qualitative Value</Text>
                      <Text size="sm">{demand.qualitativeValueCategory ? 'Yes' : 'No'}</Text>
                    </Stack>
                  )}
                  {demand.quantitativeValueCategory != null && (
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed" fw={500}>Quantitative Value</Text>
                      <Text size="sm">{demand.quantitativeValueCategory ? 'Yes' : 'No'}</Text>
                    </Stack>
                  )}
                </Stack>
              )}
            </div>

            {/* SP Offer Review (conditional) */}
            {isSpOfferReview && (
              <div ref={reviewSectionRef}>
                <Text size="sm" fw={700} c="dimmed" mb={6}>Cost Estimate Offer</Text>
                <Text size="sm" mb="sm">
                  The Demand Manager has submitted a cost estimate. Review the OPEX plan below and accept or request revisions.
                </Text>
                <Button variant="subtle" leftSection={<IconTable size={16} />} onClick={openFinPlan} style={{ alignSelf: 'flex-start' }}>
                  View Cost Estimate (OPEX)
                </Button>
                <Group mt="sm">
                  <Button color="green" loading={spAcceptOfferMutation.isPending} onClick={handleSpAcceptOffer}>Accept Offer</Button>
                  <Button color="yellow" variant="outline" onClick={() => setOfferReworkDrawerOpen(true)}>Request Rework</Button>
                </Group>
                <Drawer
                  opened={offerReworkDrawerOpen}
                  onClose={() => setOfferReworkDrawerOpen(false)}
                  title="Request Offer Rework"
                  position="right"
                >
                  <Stack>
                    <Textarea
                      label="Rework Comment"
                      required
                      placeholder="What should the DM revise in the cost estimate?"
                      value={offerReworkComment}
                      onChange={(e) => setOfferReworkComment(e.currentTarget.value)}
                    />
                    <Button
                      color="yellow"
                      disabled={!offerReworkComment.trim()}
                      loading={spReworkOfferMutation.isPending}
                      onClick={() =>
                        spReworkOfferMutation.mutate(
                          { commentary: offerReworkComment },
                          { onSuccess: () => setOfferReworkDrawerOpen(false) },
                        )
                      }
                    >
                      Confirm Rework Request
                    </Button>
                  </Stack>
                </Drawer>
              </div>
            )}

            {/* Financial Plan — hidden for SP demands when viewer is a DemandRequester */}
            {!(demand.isSmallProject && isRequester) && (
              <div>
                <Text size="sm" fw={700} c="dimmed" mb={6}>Financial Plan</Text>
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                  {planLoading
                    ? <Skeleton height={36} radius="xs" />
                    : <FinancialField label="Total Forecast OPEX" value={formatEuros(totalOpex)} />}
                  {planLoading
                    ? <Skeleton height={36} radius="xs" />
                    : <FinancialField label="Total Forecast CAPEX" value={formatEuros(totalCapex)} />}
                  {fmtDateTime(demand.submittedAt) && (
                    <FinancialField label="Submitted At" value={fmtDateTime(demand.submittedAt)!} />
                  )}
                </SimpleGrid>
                <Button
                  variant="subtle"
                  leftSection={<IconTable size={16} />}
                  onClick={openFinPlan}
                  mt="sm"
                  style={{ alignSelf: 'flex-start' }}
                >
                  View Financial Planning
                </Button>
              </div>
            )}

            {/* DM Feedback */}
            {demand.dmCommentary && (
              <Alert color="blue" title="DM Feedback" data-testid="dm-feedback">
                {demand.dmCommentary}
              </Alert>
            )}
          </Stack>
        </Card>

        {/* History card */}
        <Card withBorder shadow="sm" radius="lg" p="lg">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>Workflow History</Text>
          <DemandHistoryList demandId={demand.id} />
        </Card>
      </Stack>

      </Box>
      <FinancialPlanModal opened={finPlanOpened} onClose={closeFinPlan} demand={demand} />
    </PageLayout>
  );
}
