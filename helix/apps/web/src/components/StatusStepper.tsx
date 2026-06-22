import { Group, Stepper, Text } from '@mantine/core';
import { DemandStatus } from '@helix/shared';

export function formatActor(role: string, name?: string | null): string {
  return name ? `${role} (${name})` : role;
}

interface StepConfig {
  label: string;
  description?: string;
}

interface Props {
  status: DemandStatus;
  currentActor: string;
  nextActor: string;
  steps: StepConfig[];
  activeStep?: number;
}

const REROUTED_STATUSES: DemandStatus[] = [DemandStatus.REROUTED];

export function StatusStepper({ status, currentActor, nextActor, steps, activeStep = 0 }: Props) {
  const isRerouted = REROUTED_STATUSES.includes(status);

  return (
    <div role="status">
      <Group mb="xs">
        <Text size="sm" c="dimmed">Current: <strong>{currentActor}</strong></Text>
        <Text size="sm" c="dimmed">Next: <strong>{nextActor}</strong></Text>
      </Group>
      {isRerouted && (
        <Text size="sm" c="yellow" fw={600} mb="xs">Returned</Text>
      )}
      <Stepper active={activeStep} color={isRerouted ? 'yellow' : undefined}>
        {steps.map((step) => (
          <Stepper.Step key={step.label} label={step.label} description={step.description} />
        ))}
      </Stepper>
    </div>
  );
}
