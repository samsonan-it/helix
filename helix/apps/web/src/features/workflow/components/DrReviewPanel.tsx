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
import { useSpAcceptOffer, useSpReworkOffer } from '../hooks/useSpActions';
import { DemandReadOnlyFields } from '../../intake/DemandReadOnlyFields';
import { FinancialPlanModal } from './FinancialPlanModal';
import { WorkflowHistoryModal } from './WorkflowHistoryModal';

const SP_STEPS = [
  { label: 'Requester' },
  { label: 'DM — Review & Estimate' },
  { label: 'Requester' },
  { label: 'Portfolio Manager' },
];

const DR_STEP_INDEX = 2;

interface Props {
  demand: DemandResponse;
  onActionComplete?: () => void;
}

interface ReworkForm {
  commentary: string;
}

export function DrReviewPanel({ demand, onActionComplete }: Props) {
  const [reworkOpen, setReworkOpen] = useState(false);
  const [finPlanOpened, { open: openFinPlan, close: closeFinPlan }] = useDisclosure(false);
  const [historyOpened, { open: openHistory, close: closeHistory }] = useDisclosure(false);

  const acceptMutation = useSpAcceptOffer(demand.id);
  const reworkMutation = useSpReworkOffer(demand.id);

  const { register, getValues, watch, reset } = useForm<ReworkForm>({
    defaultValues: { commentary: '' },
  });
  const commentary = watch('commentary');

  const isOfferReview = demand.status === DemandStatus.SP_OFFER_REVIEW;

  const handleAccept = () => {
    acceptMutation.mutate(undefined, { onSuccess: () => onActionComplete?.() });
  };

  const handleRework = () => {
    const values = getValues();
    if (!values.commentary.trim()) return;
    reworkMutation.mutate(
      { commentary: values.commentary },
      {
        onSuccess: () => {
          setReworkOpen(false);
          reset();
          onActionComplete?.();
        },
      },
    );
  };

  const handleDrawerClose = () => {
    setReworkOpen(false);
    reset();
  };

  return (
    <Stack p="md">
      <StatusStepper
        status={demand.status}
        currentActor={formatActor('Requester', '')}
        nextActor="Portfolio Manager"
        steps={SP_STEPS}
        activeStep={DR_STEP_INDEX}
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

      {demand.dmCommentary && (
        <>
          <Divider label="DM Commentary" labelPosition="left" />
          <Alert color="blue" title="Demand Manager's Assessment">
            {demand.dmCommentary}
          </Alert>
        </>
      )}

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

      {isOfferReview && (
        <Group mt="md">
          <Button color="green" loading={acceptMutation.isPending} onClick={handleAccept}>
            Accept Offer
          </Button>
          <Button color="yellow" variant="outline" onClick={() => { reset(); setReworkOpen(true); }}>
            Request Rework
          </Button>
        </Group>
      )}

      <Drawer
        opened={reworkOpen}
        onClose={handleDrawerClose}
        title="Request Offer Rework"
        position="right"
      >
        <Stack>
          <Textarea
            label="Comment for DM"
            required
            placeholder="Explain what needs to be revised in the cost estimate"
            {...register('commentary')}
          />
          <Button
            color="yellow"
            disabled={!commentary.trim()}
            loading={reworkMutation.isPending}
            onClick={handleRework}
          >
            Confirm Rework Request
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
