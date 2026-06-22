import {
  Alert,
  Button,
  Divider,
  Drawer,
  Group,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import axios from 'axios';
import { DemandResponse, DemandStatus } from '@helix/shared';
import { IconHistory, IconTable } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { StatusStepper } from '../../../components/StatusStepper';
import { DemandStatusBadge } from '../../../components/DemandStatusBadge';
import { DemandTypeIndicator } from '../../../components/DemandTypeIndicator';
import { usePmApprove, usePmReject, usePmSendBack } from '../hooks/usePmActions';
import { useUsersByRole } from '../../../hooks/useUsersByRole';
import { WorkflowHistoryModal } from './WorkflowHistoryModal';
import { queryKeys } from '../../../lib/queryKeys';
import { DemandReadOnlyFields } from '../../intake/DemandReadOnlyFields';
import { FinancialPlanModal } from './FinancialPlanModal';

const PM_STEPS = [
  { label: 'Submitted' },
  { label: 'DM Review' },
  { label: 'Business Controller' },
  { label: 'Portfolio Review' },
  { label: 'Approved' },
];

const SP_PM_STEPS = [
  { label: 'Requester' },
  { label: 'DM — Review & Estimate' },
  { label: 'Requester' },
  { label: 'Portfolio Manager' },
];

const PM_REVIEW_STEP = 3;
const SP_PM_REVIEW_STEP = 3;

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

function DmAssessmentSummary({ demand }: { demand: DemandResponse }) {
  const hasDmData = demand.eaInvolved != null || demand.itSecurityInvolved != null
    || demand.itOpsInvolved != null || demand.top10Conformity || demand.dmDecision;
  if (!hasDmData) return null;

  return (
    <>
      <Divider label="DM Assessment" labelPosition="left" />
      <SimpleGrid cols={2} spacing="sm">
        <BoolField label="EA Involvement" value={demand.eaInvolved} />
        <BoolField label="IT Security Involvement" value={demand.itSecurityInvolved} />
        <BoolField label="IT Operations Involvement" value={demand.itOpsInvolved} />
        <Field label="Top 10 Conformity" value={demand.top10Conformity} />
        <Field label="DM Decision" value={demand.dmDecision} />
        <Field label="DM Commentary" value={demand.dmCommentary} />
      </SimpleGrid>
    </>
  );
}

interface Props {
  demand: DemandResponse;
  pmName: string;
  onActionComplete?: () => void;
}

export function PmReviewPanel({ demand, onActionComplete }: Props) {
  const [approveDrawerOpen, setApproveDrawerOpen] = useState(false);
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const [rejectDrawerOpen, setRejectDrawerOpen] = useState(false);
  const [sendBackDrawerOpen, setSendBackDrawerOpen] = useState(false);
  const [pmCommentary, setPmCommentary] = useState('');
  const [sendBackTarget, setSendBackTarget] = useState<'requester' | 'dm' | ''>('');
  const [sendBackCommentary, setSendBackCommentary] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [finPlanOpened, { open: openFinPlan, close: closeFinPlan }] = useDisclosure(false);
  const [historyOpened, { open: openHistory, close: closeHistory }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const { data: projectManagers = [], isLoading: pmListLoading } = useUsersByRole('ProjectManager');

  const approveMutation = usePmApprove(demand.id);
  const rejectMutation = usePmReject(demand.id);
  const sendBackMutation = usePmSendBack(demand.id);

  const isInReview = demand.status === DemandStatus.IN_REVIEW;
  const isSpDemand = demand.isSmallProject;
  const pmSteps = isSpDemand ? SP_PM_STEPS : PM_STEPS;
  const isTerminal = [DemandStatus.APPROVED, DemandStatus.IN_EXECUTION, DemandStatus.COMPLETED].includes(demand.status);
  const pmActiveStep = isSpDemand
    ? (isTerminal ? SP_PM_STEPS.length : SP_PM_REVIEW_STEP)
    : (isTerminal ? PM_STEPS.length : PM_REVIEW_STEP);

  const handleApprove = () => {
    setActionError(null);
    approveMutation.mutate(
      { assignedPmId: selectedPmId ?? undefined },
      {
        onSuccess: () => { setApproveDrawerOpen(false); onActionComplete?.(); },
        onError: (err) => {
          setApproveDrawerOpen(false);
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setActionError('This demand has already been actioned.');
            queryClient.invalidateQueries({ queryKey: queryKeys.demands.detail(demand.id) });
          } else {
            setActionError('Approval failed — please try again.');
          }
        },
      },
    );
  };

  const handleReject = () => {
    if (!pmCommentary.trim()) return;
    setActionError(null);
    rejectMutation.mutate(
      { pmCommentary },
      {
        onSuccess: () => { setRejectDrawerOpen(false); onActionComplete?.(); },
        onError: (err) => {
          setRejectDrawerOpen(false);
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setActionError('This demand has already been actioned.');
            queryClient.invalidateQueries({ queryKey: queryKeys.demands.detail(demand.id) });
          } else {
            setActionError('Rejection failed — please try again.');
          }
        },
      },
    );
  };

  const handleSendBack = () => {
    if (!sendBackTarget || !sendBackCommentary.trim()) return;
    setActionError(null);
    sendBackMutation.mutate(
      { target: sendBackTarget, commentary: sendBackCommentary },
      {
        onSuccess: () => { setSendBackDrawerOpen(false); onActionComplete?.(); },
        onError: (err) => {
          setSendBackDrawerOpen(false);
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setActionError('This demand has already been actioned.');
            queryClient.invalidateQueries({ queryKey: queryKeys.demands.detail(demand.id) });
          } else {
            setActionError('Send back failed — please try again.');
          }
        },
      },
    );
  };

  return (
    <Stack p="md">
      <StatusStepper
        status={demand.status}
        currentActor="Portfolio Manager"
        nextActor="Execution"
        steps={pmSteps}
        activeStep={pmActiveStep}
      />

      <DemandStatusBadge status={demand.status} size="md" />

      {actionError && (
        <Alert color="stadaRed">{actionError}</Alert>
      )}

      <Divider />

      {/* AC-3: demand type badge in header */}
      <Stack gap={4}>
        <Group gap="xs" align="center">
          <Title order={4}>{demand.title}</Title>
          <DemandTypeIndicator type={demand.projectType as 'P' | 'SP' | null} />
        </Group>
        <Text size="sm" c="dimmed">{demand.description}</Text>
      </Stack>

      <Divider label="Demand Details" labelPosition="left" />
      <DemandReadOnlyFields demand={demand} />


      {/* AC-5: View Financial Planning button */}
      <Button
        variant="subtle"
        leftSection={<IconTable size={16} />}
        onClick={openFinPlan}
        style={{ alignSelf: 'flex-start' }}
      >
        View Financial Planning
      </Button>

      <FinancialPlanModal opened={finPlanOpened} onClose={closeFinPlan} demand={demand} />

      <Button
        variant="subtle"
        leftSection={<IconHistory size={16} />}
        onClick={openHistory}
        style={{ alignSelf: 'flex-start' }}
      >
        View Workflow History
      </Button>
      <WorkflowHistoryModal demandId={demand.id} opened={historyOpened} onClose={closeHistory} />

      <DmAssessmentSummary demand={demand} />

      {isInReview && (
        <Group mt="md">
          <Button color="green" onClick={() => { setSelectedPmId(null); setApproveDrawerOpen(true); }}>Approve</Button>
          <Button color="stadaRed" variant="outline" onClick={() => setRejectDrawerOpen(true)}>Reject</Button>
          <Button color="orange" variant="outline" onClick={() => setSendBackDrawerOpen(true)}>Send Back</Button>
        </Group>
      )}

      <Drawer
        opened={approveDrawerOpen}
        onClose={() => setApproveDrawerOpen(false)}
        title="Approve Demand — Assign Project Manager"
        position="right"
      >
        <Stack>
          <Select
            label="Project Manager"
            placeholder="Select a Project Manager (optional)"
            searchable
            data={projectManagers.map((u) => ({ value: u.id, label: u.name }))}
            value={selectedPmId}
            onChange={setSelectedPmId}
            disabled={pmListLoading}
            nothingFoundMessage="No Project Managers found"
          />
          <Group>
            <Button
              color="green"
              loading={approveMutation.isPending}
              onClick={handleApprove}
            >
              Confirm Approval
            </Button>
            <Button variant="subtle" onClick={() => setApproveDrawerOpen(false)}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Drawer
        opened={rejectDrawerOpen}
        onClose={() => setRejectDrawerOpen(false)}
        title="Reject Demand"
        position="right"
      >
        <Stack>
          <Textarea
            label="PM Commentary"
            required
            placeholder="Explain why this demand is rejected"
            value={pmCommentary}
            onChange={(e) => setPmCommentary(e.currentTarget.value)}
          />
          <Button
            color="stadaRed"
            disabled={!pmCommentary.trim()}
            loading={rejectMutation.isPending}
            onClick={handleReject}
          >
            Confirm Rejection
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={sendBackDrawerOpen}
        onClose={() => { setSendBackDrawerOpen(false); setSendBackTarget(''); setSendBackCommentary(''); }}
        title="Send Back Demand"
        position="right"
      >
        <Stack>
          <Radio.Group
            label="Send back to"
            value={sendBackTarget}
            onChange={(val) => setSendBackTarget(val as 'requester' | 'dm')}
          >
            <Stack mt="xs">
              <Radio value="requester" label="Send to Requester" />
              <Radio value="dm" label="Send to Demand Manager" />
            </Stack>
          </Radio.Group>
          <Textarea
            label="Commentary"
            required
            placeholder="Explain why this demand is being sent back"
            value={sendBackCommentary}
            onChange={(e) => setSendBackCommentary(e.currentTarget.value)}
          />
          <Button
            color="orange"
            disabled={!sendBackTarget || !sendBackCommentary.trim()}
            loading={sendBackMutation.isPending}
            onClick={handleSendBack}
          >
            Confirm Send Back
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
