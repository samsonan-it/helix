import {
  Alert,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { DemandResponse, DemandStatus } from '@helix/shared';
import { IconHistory, IconTable } from '@tabler/icons-react';
import { StatusStepper, formatActor } from '../../../components/StatusStepper';
import { DemandStatusBadge } from '../../../components/DemandStatusBadge';
import { DemandTypeIndicator } from '../../../components/DemandTypeIndicator';
import { useBcApprove, useBcReject, useBcSendToRequester } from '../hooks/useBcActions';
import { DemandReadOnlyFields } from '../../intake/DemandReadOnlyFields';
import { FinancialPlanModal } from './FinancialPlanModal';
import { WorkflowHistoryModal } from './WorkflowHistoryModal';

const BC_STEPS = [
  { label: 'Requester' },
  { label: 'Demand Manager' },
  { label: 'Business Controller' },
  { label: 'Portfolio Manager' },
];

const BC_STEP_INDEX = 2;

type DrawerType = 'reject' | 'sendToRequester' | null;

interface Props {
  demand: DemandResponse;
  bcName: string;
  onActionComplete?: () => void;
}

interface CommentaryForm {
  commentary: string;
}

export function BcReviewPanel({ demand, bcName, onActionComplete }: Props) {
  const isRerouted = demand.status === DemandStatus.REROUTED;
  const bcSteps = BC_STEPS.map((step, i) =>
    i === BC_STEP_INDEX && isRerouted ? { label: 'Returned' } : step,
  );

  const [drawerType, setDrawerType] = useState<DrawerType>(null);
  const [finPlanOpened, { open: openFinPlan, close: closeFinPlan }] = useDisclosure(false);
  const [historyOpened, { open: openHistory, close: closeHistory }] = useDisclosure(false);

  const approveMutation = useBcApprove(demand.id);
  const rejectMutation = useBcReject(demand.id);
  const sendToRequesterMutation = useBcSendToRequester(demand.id);

  const { register, getValues, watch, reset } = useForm<CommentaryForm>({
    defaultValues: { commentary: '' },
  });
  const commentary = watch('commentary');

  const isBcReview = demand.status === DemandStatus.BC_REVIEW;

  const handleApprove = () => {
    approveMutation.mutate(undefined, { onSuccess: () => onActionComplete?.() });
  };

  const handleReject = () => {
    const values = getValues();
    if (!values.commentary.trim()) return;
    rejectMutation.mutate(
      { commentary: values.commentary },
      {
        onSuccess: () => {
          setDrawerType(null);
          reset();
          onActionComplete?.();
        },
      },
    );
  };

  const handleSendToRequester = () => {
    const values = getValues();
    if (!values.commentary.trim()) return;
    sendToRequesterMutation.mutate(
      { commentary: values.commentary },
      {
        onSuccess: () => {
          setDrawerType(null);
          reset();
          onActionComplete?.();
        },
      },
    );
  };

  const handleDrawerClose = () => {
    setDrawerType(null);
    reset();
  };

  return (
    <Stack p="md">
      <StatusStepper
        status={demand.status}
        currentActor={formatActor('Business Controller', bcName)}
        nextActor="Portfolio Manager"
        steps={bcSteps}
        activeStep={BC_STEP_INDEX}
      />

      <DemandStatusBadge status={demand.status} size="md" />

      <Divider />

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

      {/* DM Commentary — shown for context */}
      {demand.dmCommentary && (
        <>
          <Divider label="DM Commentary" labelPosition="left" />
          <Alert color="blue" title="Demand Manager's Assessment">
            {demand.dmCommentary}
          </Alert>
        </>
      )}

      {/* Financial Planning — read-only view */}
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

      {/* BC Actions — only shown while demand is in BC_REVIEW */}
      {isBcReview && (
        <Group mt="md">
          <Button color="green" onClick={handleApprove}>
            Approve
          </Button>
          <Button color="stadaRed" variant="outline" onClick={() => { reset(); setDrawerType('reject'); }}>
            Reject
          </Button>
          <Button color="yellow" variant="outline" onClick={() => { reset(); setDrawerType('sendToRequester'); }}>
            Send to Requester
          </Button>
        </Group>
      )}

      {/* Reject drawer */}
      <Drawer
        opened={drawerType === 'reject'}
        onClose={handleDrawerClose}
        title="Reject Demand"
        position="right"
      >
        <Stack>
          <Textarea
            label="Rejection Reason"
            required
            placeholder="Explain why this demand is rejected"
            {...register('commentary')}
          />
          <Button
            color="stadaRed"
            disabled={!commentary.trim()}
            loading={rejectMutation.isPending}
            onClick={handleReject}
          >
            Confirm Rejection
          </Button>
        </Stack>
      </Drawer>

      {/* Send to Requester drawer */}
      <Drawer
        opened={drawerType === 'sendToRequester'}
        onClose={handleDrawerClose}
        title="Send Back to Requester"
        position="right"
      >
        <Stack>
          <Textarea
            label="Comment for Requester"
            required
            placeholder="Explain what needs to be corrected"
            {...register('commentary')}
          />
          <Button
            color="yellow"
            disabled={!commentary.trim()}
            loading={sendToRequesterMutation.isPending}
            onClick={handleSendToRequester}
          >
            Confirm Send Back
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
