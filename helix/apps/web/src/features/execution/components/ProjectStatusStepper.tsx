import { Badge, Stepper } from '@mantine/core';

interface Props {
  status: string;
}

function statusToActiveStep(status: string): number {
  switch (status) {
    case 'DRAFT':               return 0;
    case 'PENDING_APPROVAL':    return 1;
    case 'IN_EXECUTION':
    case 'ASSUMED_COMPLETED':   return 2;
    case 'PREPARE_FOR_CLOSURE': return 3;
    case 'COMPLETED':           return 4;
    default:                    return 0;
  }
}

export function ProjectStatusStepper({ status }: Props) {
  if (status === 'CANCELLED') {
    return <Badge color="gray">Cancelled</Badge>;
  }

  return (
    <div role="status">
      <Stepper active={statusToActiveStep(status)} size="sm">
        <Stepper.Step label="Draft" />
        <Stepper.Step label="Pending Approval" />
        <Stepper.Step label="In Execution" />
        <Stepper.Step label="Prepare for Closure" />
        <Stepper.Step label="Completed" />
      </Stepper>
    </div>
  );
}
