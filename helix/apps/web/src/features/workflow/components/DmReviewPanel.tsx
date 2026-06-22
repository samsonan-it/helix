import {
  Alert,
  Button,
  Divider,
  Drawer,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { DemandResponse, DemandStatus, SpStep, dmAssessmentBaseSchema } from '@helix/shared';
import { IconHistory, IconTable } from '@tabler/icons-react';
import { z } from 'zod';
import { StatusStepper, formatActor } from '../../../components/StatusStepper';
import { DemandStatusBadge } from '../../../components/DemandStatusBadge';
import { DemandTypeIndicator } from '../../../components/DemandTypeIndicator';
import { useDmAccept, useDmReject, useDmReturn, useDmPostpone, useDmResume } from '../hooks/useDmActions';
import { useSpAcceptAndEstimate, useConvertToSmallProject } from '../hooks/useSpActions';
import { useGetFinancialPlan, usePatchFinancialPlan, useUpdateDemandDates, useSaveAssessmentDraft } from '../../intake/intake.queries';
import { DemandReadOnlyFields } from '../../intake/DemandReadOnlyFields';
import { FinancialPlanModal } from './FinancialPlanModal';
import { WorkflowHistoryModal } from './WorkflowHistoryModal';
import { FinancialGrid } from '@helix/ui';

const dmAssessmentSchema = dmAssessmentBaseSchema.extend({
  reworkCommentary: z.string().optional(),
  dmCommentary: z.string().optional(),
  onHoldReason: z.string().optional(),
});

type DmAssessmentForm = z.infer<typeof dmAssessmentSchema>;

const P_STEPS_WITH_BC = [
  { label: 'Requester' },
  { label: 'Demand Manager' },
  { label: 'Business Controller' },
  { label: 'Portfolio Manager' },
];

const SP_STEPS = [
  { label: 'Requester' },
  { label: 'DM — Review & Estimate' },
  { label: 'Requester' },
  { label: 'Portfolio Manager' },
];

const SP_STEP_INDEX: Record<string, number> = {
  [SpStep.DM_COST_ESTIMATION]: 1,
  [SpStep.DR_OFFER_REVIEW]:    2,
  [SpStep.PM_DECISION]:        3,
};

const DM_REVIEW_STEP = 1;

interface Props {
  demand: DemandResponse;
  dmName: string;
  onActionComplete?: () => void;
}

type DrawerType = 'rework' | 'reject' | 'postpone' | 'convert-to-sp' | 'capex-warning' | null;

export function DmReviewPanel({ demand, dmName, onActionComplete }: Props) {
  const [drawerType, setDrawerType] = useState<DrawerType>(null);
  const [convertToSpError, setConvertToSpError] = useState<string | null>(null);
  const [spSubmitError, setSpSubmitError] = useState<string | null>(null);
  const [finPlanOpened, { open: openFinPlan, close: closeFinPlan }] = useDisclosure(false);
  const [historyOpened, { open: openHistory, close: closeHistory }] = useDisclosure(false);

  // Local date state — re-synced from demand prop after each successful patch (AC-3, AC-4)
  const [localStartDate, setLocalStartDate] = useState<string | null>(demand.startDate ? demand.startDate.slice(0, 10) : null);
  const [localEndDate, setLocalEndDate]     = useState<string | null>(demand.endDate   ? demand.endDate.slice(0, 10)   : null);

  useEffect(() => {
    setLocalStartDate(demand.startDate ? demand.startDate.slice(0, 10) : null);
    setLocalEndDate(demand.endDate     ? demand.endDate.slice(0, 10)   : null);
  }, [demand.startDate, demand.endDate]);

  const datesValid = !!localStartDate && !!localEndDate && localEndDate >= localStartDate;

  const updateDatesMutation = useUpdateDemandDates();

  const handleDateBlur = () => {
    if (!localStartDate && !localEndDate) {
      updateDatesMutation.mutate(
        { demandId: demand.id, dto: { startDate: null, endDate: null } },
        {
          onError: () => {
            setLocalStartDate(demand.startDate ? demand.startDate.slice(0, 10) : null);
            setLocalEndDate(demand.endDate     ? demand.endDate.slice(0, 10)   : null);
            notifications.show({ color: 'red', title: 'Could not save dates', message: 'Please try again.' });
          },
        },
      );
      return;
    }
    if (!datesValid) return;
    updateDatesMutation.mutate(
      { demandId: demand.id, dto: { startDate: localStartDate, endDate: localEndDate } },
      {
        onError: () => {
          setLocalStartDate(demand.startDate ? demand.startDate.slice(0, 10) : null);
          setLocalEndDate(demand.endDate     ? demand.endDate.slice(0, 10)   : null);
          notifications.show({ color: 'red', title: 'Could not save dates', message: 'Please try again.' });
        },
      },
    );
  };

  const saveAssessmentDraftMutation = useSaveAssessmentDraft();

  const acceptMutation = useDmAccept(demand.id);
  const returnMutation = useDmReturn(demand.id);
  const rejectMutation = useDmReject(demand.id);
  const postponeMutation = useDmPostpone(demand.id);
  const resumeMutation = useDmResume(demand.id);
  const spAcceptAndEstimateMutation = useSpAcceptAndEstimate(demand.id);
  const convertToSpMutation = useConvertToSmallProject(demand.id);

  // SP flow state
  const isSpDemand = demand.isSmallProject;
  const spStep = demand.spStep ?? null;
  const isSubmitted = demand.status === DemandStatus.SUBMITTED;
  const isRerouted = demand.status === DemandStatus.REROUTED;
  const isOnHold = demand.status === DemandStatus.ON_HOLD;
  const isSpDmReview = isSpDemand && spStep === null && isSubmitted;
  const isSpCostEstimation = isSpDemand && spStep === SpStep.DM_COST_ESTIMATION && (isSubmitted || isRerouted);
  // Combined DM step: first-time review (spStep=null) or rework re-entry (spStep=DM_COST_ESTIMATION)
  const isSpCombinedDmStep = isSpDmReview || isSpCostEstimation;

  const isBcReview = demand.status === DemandStatus.BC_REVIEW;
  const isPDemandAtDmStep = !isSpDemand && (isSubmitted || isBcReview);
  const { data: financialPlan, isSuccess: isFinancialPlanLoaded } = useGetFinancialPlan(
    (isSpCombinedDmStep || isPDemandAtDmStep) ? demand.id : undefined,
  );
  const patchPlan = usePatchFinancialPlan();

  const canConvertToSp = isPDemandAtDmStep && isFinancialPlanLoaded;

  const opexGlAccounts = (financialPlan?.glAccounts ?? []).filter((t) => t.category === 'opex');
  const opexEntries = (financialPlan?.entries ?? []).filter((e) =>
    e.category === 'opex' && opexGlAccounts.some((t) => t.id === e.glAccountId),
  );

  const benefitsGlAccounts = (financialPlan?.glAccounts ?? []).filter((t) => t.category === 'benefits');
  const benefitsEntries = (financialPlan?.entries ?? []).filter((e) =>
    e.category === 'benefits' && benefitsGlAccounts.some((t) => t.id === e.glAccountId),
  );
  const spGridGlAccounts = [...benefitsGlAccounts, ...opexGlAccounts];
  const spGridEntries = [...benefitsEntries, ...opexEntries];

  const hasCapexEntries = (financialPlan?.entries ?? []).some((e) => e.category === 'capex' && e.valueCents > 0);

  // StatusStepper configuration
  const activeStep = isSpDemand
    ? (spStep ? SP_STEP_INDEX[spStep] ?? DM_REVIEW_STEP : DM_REVIEW_STEP)
    : DM_REVIEW_STEP;
  const steps = isSpDemand ? SP_STEPS : P_STEPS_WITH_BC;
  const nextActor = isSpDemand ? 'Originator' : 'Business Controller';

  const [fundingTypeSubmitAttempted, setFundingTypeSubmitAttempted] = useState(false);

  useEffect(() => {
    setFundingTypeSubmitAttempted(false);
  }, [demand.id]);

  const { register, control, getValues } = useForm<DmAssessmentForm>({
    resolver: zodResolver(dmAssessmentSchema),
    defaultValues: {
      eaInvolved: demand.eaInvolved ?? false,
      eaComment: demand.eaComment ?? '',
      itSecurityInvolved: demand.itSecurityInvolved ?? false,
      itSecurityComment: demand.itSecurityComment ?? '',
      itOpsInvolved: demand.itOpsInvolved ?? false,
      itOpsComment: demand.itOpsComment ?? '',
      fundingType: (demand.fundingType as 'Business' | 'IT' | undefined) ?? undefined,
      glAccountId: demand.glAccountId ?? null,
      reworkCommentary: '',
      dmCommentary: '',
      onHoldReason: '',
    },
  });

  const watchedValues = useWatch({ control }) as DmAssessmentForm;
  const { eaInvolved, itSecurityInvolved, itOpsInvolved, reworkCommentary, dmCommentary, onHoldReason, fundingType } = watchedValues;

  const handleAccept = () => {
    const values = getValues();
    setFundingTypeSubmitAttempted(true);
    if (!values.fundingType) return;
    acceptMutation.mutate({
      eaInvolved: values.eaInvolved,
      eaComment: values.eaComment,
      itSecurityInvolved: values.itSecurityInvolved,
      itSecurityComment: values.itSecurityComment,
      itOpsInvolved: values.itOpsInvolved,
      itOpsComment: values.itOpsComment,
      fundingType: values.fundingType,
      glAccountId: values.glAccountId,
    }, { onSuccess: () => onActionComplete?.() });
  };

  const handleRework = () => {
    const values = getValues();
    setFundingTypeSubmitAttempted(true);
    if (!values.fundingType) return;
    if (!values.reworkCommentary?.trim()) return;
    returnMutation.mutate({
      dmCommentary: values.reworkCommentary,
      eaInvolved: values.eaInvolved,
      eaComment: values.eaComment,
      itSecurityInvolved: values.itSecurityInvolved,
      itSecurityComment: values.itSecurityComment,
      itOpsInvolved: values.itOpsInvolved,
      itOpsComment: values.itOpsComment,
      fundingType: values.fundingType as 'Business' | 'IT',
      glAccountId: values.glAccountId,
    }, { onSuccess: () => { setDrawerType(null); onActionComplete?.(); } });
  };

  const handleReject = () => {
    const values = getValues();
    setFundingTypeSubmitAttempted(true);
    if (!values.fundingType) return;
    if (!values.dmCommentary?.trim()) return;
    rejectMutation.mutate(
      {
        dmCommentary: values.dmCommentary,
        eaInvolved: values.eaInvolved,
        eaComment: values.eaComment,
        itSecurityInvolved: values.itSecurityInvolved,
        itSecurityComment: values.itSecurityComment,
        itOpsInvolved: values.itOpsInvolved,
        itOpsComment: values.itOpsComment,
        fundingType: values.fundingType as 'Business' | 'IT',
        glAccountId: values.glAccountId,
      },
      { onSuccess: () => { setDrawerType(null); onActionComplete?.(); } },
    );
  };

  const handlePostpone = () => {
    const values = getValues();
    postponeMutation.mutate(
      { onHoldReason: values.onHoldReason ?? '' },
      { onSuccess: () => { setDrawerType(null); onActionComplete?.(); } },
    );
  };

  return (
    <Stack p="md">
      <StatusStepper
        status={demand.status}
        currentActor={formatActor('Demand Manager', dmName)}
        nextActor={nextActor}
        steps={steps}
        activeStep={activeStep}
      />

      {/* AC-1: status badge after StatusStepper */}
      <DemandStatusBadge status={demand.status} size="md" />

      <Divider />

      {/* AC-3: demand type badge in header */}
      <Stack gap={4}>
        <Text size="sm" c="dimmed">#{demand.publicId}</Text>
        <Group gap="xs" align="center">
          <Title order={4}>{demand.title}</Title>
          <DemandTypeIndicator type={demand.projectType as 'P' | 'SP' | null} />
        </Group>
        <Text size="sm" c="dimmed">{demand.description}</Text>
      </Stack>

      <Divider label="Demand Details" labelPosition="left" />
      <DemandReadOnlyFields demand={demand} />



      <Button
        variant="subtle"
        leftSection={<IconHistory size={16} />}
        onClick={openHistory}
        style={{ alignSelf: 'flex-start' }}
      >
        View Workflow History
      </Button>
      <WorkflowHistoryModal demandId={demand.id} opened={historyOpened} onClose={closeHistory} />

      {/* Edit Financial Planning — P demands only (SP uses inline grid). AC-4, AC-7 */}
      {!isSpDemand && (
        <>
          <Divider label="Project Dates" labelPosition="left" />
          <Text size="xs" c="dimmed">Planning period — defines the month columns in the financial plan.</Text>
          <Group grow>
            <DateInput
              id="start-date-input"
              label="Start Date"
              value={localStartDate}
              onChange={(val) => setLocalStartDate(val)}
              onBlur={handleDateBlur}
              valueFormat="YYYY-MM-DD"
            />
            <DateInput
              label="End Date"
              value={localEndDate}
              onChange={(val) => setLocalEndDate(val)}
              onBlur={handleDateBlur}
              valueFormat="YYYY-MM-DD"
              error={!datesValid && !!localStartDate && !!localEndDate ? 'End date cannot be before start date' : undefined}
            />
          </Group>
          {datesValid ? (
            <Button
              variant="subtle"
              leftSection={<IconTable size={16} />}
              onClick={openFinPlan}
              style={{ alignSelf: 'flex-start' }}
            >
              Edit Financial Planning
            </Button>
          ) : (
            <Stack gap={4}>
              <Button
                variant="subtle"
                leftSection={<IconTable size={16} />}
                aria-disabled
                onClick={() => {}}
                style={{ alignSelf: 'flex-start' }}
              >
                Edit Financial Planning
              </Button>
              <Text size="xs" c="red">Set valid start and end dates before editing the financial plan.</Text>
            </Stack>
          )}
          <FinancialPlanModal opened={finPlanOpened} onClose={closeFinPlan} demand={demand} editable />
        </>
      )}

      {/* SP: Combined DM Review + Cost Estimation (AC-3, AC-6, Story 2.13) */}
      {isSpCombinedDmStep && (
        <>
          <Divider label="Project Dates" labelPosition="left" />
          <Text size="xs" c="dimmed">Planning period — defines the month columns below.</Text>
          <Group grow>
            <DateInput
              id="start-date-input"
              label="Start Date"
              value={localStartDate}
              onChange={(val) => setLocalStartDate(val)}
              onBlur={handleDateBlur}
              valueFormat="YYYY-MM-DD"
            />
            <DateInput
              label="End Date"
              value={localEndDate}
              onChange={(val) => setLocalEndDate(val)}
              onBlur={handleDateBlur}
              valueFormat="YYYY-MM-DD"
              error={!datesValid && !!localStartDate && !!localEndDate ? 'End date cannot be before start date' : undefined}
            />
          </Group>

          <Divider label="Cost Estimate (OPEX + Benefits)" labelPosition="left" />
          {demand.drCommentary && (
            <Alert color="yellow" title="Originator's rework comment">
              {demand.drCommentary}
            </Alert>
          )}
          {financialPlan && spGridGlAccounts.length > 0 ? (
            !localStartDate && !localEndDate ? (
              <Alert color="yellow">
                Set the start and end dates above to see the planning grid.
              </Alert>
            ) : (
              <FinancialGrid
                glAccounts={spGridGlAccounts}
                entries={spGridEntries}
                sections={['benefits', 'opex']}
                startDate={localStartDate}
                endDate={localEndDate}
                readOnly={false}
                onCellChange={(glAccountId, category, month, year, valueCents) => {
                  patchPlan.mutate(
                    { demandId: demand.id, dto: { entries: [{ glAccountId, category, month, year, valueCents }] } },
                    { onError: () => notifications.show({ color: 'red', title: 'Could not save', message: 'Could not save financial plan entry — please try again.' }) },
                  );
                }}
              />
            )
          ) : (
            <Text c="dimmed" size="sm">
              No OPEX or Benefits line item types configured. Contact Admin to set up line item types before entering the cost estimate.
            </Text>
          )}
          {!opexEntries.some((e) => e.valueCents > 0) && datesValid && (
            <Text size="sm" c="red">Please enter the cost estimate before accepting.</Text>
          )}
          <Group mt="xs">
            <Stack gap={4}>
              <Button
                color="green"
                loading={spAcceptAndEstimateMutation.isPending}
                aria-disabled={!datesValid || !opexEntries.some((e) => e.valueCents > 0)}
                onClick={() => {
                  if (!datesValid || !opexEntries.some((e) => e.valueCents > 0)) return;
                  setSpSubmitError(null);
                  spAcceptAndEstimateMutation.mutate(undefined, {
                    onSuccess: () => onActionComplete?.(),
                    onError: (err: unknown) => {
                      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                      setSpSubmitError(detail ?? 'Submission failed — please try again.');
                    },
                  });
                }}
              >
                Accept & Submit Estimate
              </Button>
              {!datesValid && (
                <Text size="xs" c="red">Correct the dates above to submit the estimate.</Text>
              )}
              {spSubmitError && (
                <Alert color="stadaRed" mt="xs">{spSubmitError}</Alert>
              )}
            </Stack>
            <Button color="yellow" variant="outline" onClick={() => setDrawerType('rework')}>Request Rework</Button>
            <Button color="stadaRed" variant="outline" onClick={() => setDrawerType('reject')}>Reject</Button>
            <Button variant="subtle" onClick={() => setDrawerType('postpone')}>Postpone</Button>
          </Group>
        </>
      )}

      {/* P demand DM Assessment */}
      {isSubmitted && !isSpDemand && (
        <>
          <Divider label="DM Assessment" labelPosition="left" />

          <Stack gap="sm">
            <Controller
              control={control}
              name="eaInvolved"
              render={({ field }) => (
                <Switch
                  label="Involvement of Enterprise Architecture"
                  checked={field.value}
                  onChange={(e) => {
                    field.onChange(e.currentTarget.checked);
                    saveAssessmentDraftMutation.mutate({ demandId: demand.id, dto: { eaInvolved: e.currentTarget.checked } });
                  }}
                />
              )}
            />
            {eaInvolved && (
              <Textarea {...register('eaComment')} onBlur={(e) => {
                saveAssessmentDraftMutation.mutate({ demandId: demand.id, dto: { eaComment: e.target.value } });
              }} />
            )}

            <Controller
              control={control}
              name="itSecurityInvolved"
              render={({ field }) => (
                <Switch
                  label="Involvement of IT Security"
                  checked={field.value}
                  onChange={(e) => {
                    field.onChange(e.currentTarget.checked);
                    saveAssessmentDraftMutation.mutate({ demandId: demand.id, dto: { itSecurityInvolved: e.currentTarget.checked } });
                  }}
                />
              )}
            />
            {itSecurityInvolved && (
              <Textarea {...register('itSecurityComment')} onBlur={(e) => {
                saveAssessmentDraftMutation.mutate({ demandId: demand.id, dto: { itSecurityComment: e.target.value } });
              }} />
            )}

            <Controller
              control={control}
              name="itOpsInvolved"
              render={({ field }) => (
                <Switch
                  label="Involvement of IT Operations"
                  checked={field.value}
                  onChange={(e) => {
                    field.onChange(e.currentTarget.checked);
                    saveAssessmentDraftMutation.mutate({ demandId: demand.id, dto: { itOpsInvolved: e.currentTarget.checked } });
                  }}
                />
              )}
            />
            {itOpsInvolved && (
              <Textarea {...register('itOpsComment')} onBlur={(e) => {
                saveAssessmentDraftMutation.mutate({ demandId: demand.id, dto: { itOpsComment: e.target.value } });
              }} />
            )}

            <Controller
              control={control}
              name="fundingType"
              render={({ field }) => (
                <Stack gap={4}>
                  <Text size="sm" fw={500}>Funding Type</Text>
                  <SegmentedControl
                    data={['Business', 'IT']}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                </Stack>
              )}
            />
          </Stack>

          <Group mt="md">
            <Stack gap={4}>
              <Button
                color="green"
                aria-disabled={!fundingType}
                loading={acceptMutation.isPending}
                onClick={handleAccept}
              >
                Accept
              </Button>
              {fundingTypeSubmitAttempted && !fundingType && (
                <Text size="xs" c="red">Please select a Funding Type</Text>
              )}
            </Stack>
            <Button color="yellow" variant="outline" onClick={() => setDrawerType('rework')}>Request Rework</Button>
            <Button color="stadaRed" variant="outline" onClick={() => setDrawerType('reject')}>Reject</Button>
            <Button variant="subtle" onClick={() => setDrawerType('postpone')}>Postpone</Button>
          </Group>

          {/* AC-1: Convert to SP button — only shown when budget ≤ SP threshold */}
          {canConvertToSp && (
            <>
              <Divider />
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  The estimated budget is within the Small Project threshold. You can convert this demand to a Small Project to skip the Business Controller step and use the simplified SP approval path.
                </Text>
                <Button
                  variant="outline"
                  color="blue"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    if (hasCapexEntries) { setDrawerType('capex-warning'); }
                    else { setConvertToSpError(null); setDrawerType('convert-to-sp'); }
                  }}
                >
                  Convert to Small Project
                </Button>
              </Stack>
            </>
          )}
        </>
      )}

      {isOnHold && (
        <Group mt="md">
          <Button
            color="blue"
            loading={resumeMutation.isPending}
            onClick={() => resumeMutation.mutate(undefined, { onSuccess: () => onActionComplete?.() })}
          >
            Resume
          </Button>
        </Group>
      )}

      {/* Rework drawer */}
      <Drawer opened={drawerType === 'rework'} onClose={() => setDrawerType(null)} title="Request Rework" position="right">
        <Stack>
          <Textarea label="DM Commentary" required placeholder="Explain what needs to be corrected" {...register('reworkCommentary')} />
          <Button
            color="yellow"
            disabled={!reworkCommentary?.trim()}
            loading={returnMutation.isPending}
            onClick={handleRework}
          >
            Confirm Rework Request
          </Button>
        </Stack>
      </Drawer>

      {/* Reject drawer */}
      <Drawer opened={drawerType === 'reject'} onClose={() => setDrawerType(null)} title="Reject Demand" position="right">
        <Stack>
          <Textarea label="Rejection Reason" required placeholder="Explain why this demand is rejected" {...register('dmCommentary')} />
          <Button
            color="stadaRed"
            disabled={!dmCommentary?.trim()}
            loading={rejectMutation.isPending}
            onClick={handleReject}
          >
            Confirm Rejection
          </Button>
        </Stack>
      </Drawer>

      {/* Postpone drawer */}
      <Drawer opened={drawerType === 'postpone'} onClose={() => setDrawerType(null)} title="Postpone Demand" position="right">
        <Stack>
          <Textarea label="Reason for Postponement" required placeholder="Why is this being put on hold?" {...register('onHoldReason')} />
          <Button
            disabled={!onHoldReason?.trim()}
            loading={postponeMutation.isPending}
            onClick={handlePostpone}
          >
            Confirm Postponement
          </Button>
        </Stack>
      </Drawer>

      {/* CAPEX warning drawer */}
      <Drawer opened={drawerType === 'capex-warning'} onClose={() => setDrawerType(null)} title="Cannot Convert to Small Project" position="right">
        <Stack>
          <Alert color="orange" title="CAPEX entries present">
            The financial plan contains CAPEX entries. Small Projects cannot have CAPEX.
            Remove the CAPEX entries or move their values to OPEX using the "Edit Financial Planning"
            grid above, then try again.
          </Alert>
          <Button onClick={() => setDrawerType(null)}>Close</Button>
        </Stack>
      </Drawer>

      {/* Convert to SP confirmation drawer */}
      <Drawer opened={drawerType === 'convert-to-sp'} onClose={() => setDrawerType(null)} title="Convert to Small Project" position="right">
        <Stack>
          <Text size="sm">
            This will convert the demand to a Small Project. The demand will:
          </Text>
          <Text size="sm" component="ul" style={{ paddingLeft: '1.2rem' }}>
            <li>Be removed from the Business Controller queue (if applicable)</li>
            <li>Follow the simplified SP approval path (DM → Requester → PM)</li>
            <li>Go directly to the Requester for offer review (no second DM step)</li>
            <li>Have all existing data preserved</li>
          </Text>
          <Text size="sm" c="dimmed">
            This action is recorded as a distinct audit event and cannot be undone automatically.
          </Text>
          {convertToSpError && <Alert color="stadaRed">{convertToSpError}</Alert>}
          <Button
            color="blue"
            loading={convertToSpMutation.isPending}
            disabled={convertToSpMutation.isPending}
            onClick={() => convertToSpMutation.mutate(undefined, {
              onSuccess: () => { setDrawerType(null); onActionComplete?.(); },
              onError: (err: unknown) => {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                setConvertToSpError(msg ?? 'Conversion failed — please try again.');
              },
            })}
          >
            Confirm Conversion to Small Project
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
