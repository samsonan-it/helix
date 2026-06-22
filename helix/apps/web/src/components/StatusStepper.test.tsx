import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DemandStatus } from '@helix/shared';
import { StatusStepper } from './StatusStepper';

const steps = [
  { label: 'Submitted' },
  { label: 'DM Review' },
  { label: 'Portfolio Review' },
  { label: 'Approved' },
];

function renderStepper(props: { status: DemandStatus; activeStep?: number }) {
  return render(
    <MantineProvider>
      <StatusStepper
        status={props.status}
        currentActor="Jane DM"
        nextActor="Portfolio Manager"
        steps={steps}
        activeStep={props.activeStep}
      />
    </MantineProvider>,
  );
}

describe('StatusStepper', () => {
  it('has role="status"', () => {
    renderStepper({ status: DemandStatus.SUBMITTED, activeStep: 1 });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays currentActor and nextActor', () => {
    renderStepper({ status: DemandStatus.SUBMITTED, activeStep: 1 });
    expect(screen.getByText(/Jane DM/)).toBeInTheDocument();
    expect(screen.getByText(/Portfolio Manager/)).toBeInTheDocument();
  });

  it('renders all step labels', () => {
    renderStepper({ status: DemandStatus.SUBMITTED, activeStep: 1 });
    expect(screen.getByText('DM Review')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Review')).toBeInTheDocument();
  });

  it('IC-7: REROUTED status renders amber "Returned" label', () => {
    renderStepper({ status: DemandStatus.REROUTED, activeStep: 1 });
    expect(screen.getByText('Returned')).toBeInTheDocument();
  });

  it('non-REROUTED status does not render "Returned" label', () => {
    renderStepper({ status: DemandStatus.SUBMITTED, activeStep: 1 });
    expect(screen.queryByText('Returned')).not.toBeInTheDocument();
  });
});
