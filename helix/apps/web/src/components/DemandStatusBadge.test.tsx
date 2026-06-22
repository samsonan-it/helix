import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DemandStatus } from '@helix/shared';
import { DemandStatusBadge } from './DemandStatusBadge';

function renderBadge(status: DemandStatus, isStalled?: boolean) {
  return render(
    <MantineProvider>
      <DemandStatusBadge status={status} isStalled={isStalled} />
    </MantineProvider>,
  );
}

describe('DemandStatusBadge', () => {
  it('DRAFT renders "Draft"', () => {
    renderBadge(DemandStatus.DRAFT);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('SUBMITTED renders "Pending DM Review"', () => {
    renderBadge(DemandStatus.SUBMITTED);
    expect(screen.getByText('Pending DM Review')).toBeInTheDocument();
  });

  it('SP_OFFER_REVIEW renders "Awaiting Requester Review"', () => {
    renderBadge(DemandStatus.SP_OFFER_REVIEW);
    expect(screen.getByText('Awaiting Requester Review')).toBeInTheDocument();
  });

  it('IN_REVIEW renders "Awaiting PM Approval"', () => {
    renderBadge(DemandStatus.IN_REVIEW);
    expect(screen.getByText('Awaiting PM Approval')).toBeInTheDocument();
  });

  it('REROUTED renders "Rework Needed"', () => {
    renderBadge(DemandStatus.REROUTED);
    expect(screen.getByText('Rework Needed')).toBeInTheDocument();
  });

  it('APPROVED renders "Approved"', () => {
    renderBadge(DemandStatus.APPROVED);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('REJECTED renders "Rejected"', () => {
    renderBadge(DemandStatus.REJECTED);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('ON_HOLD renders "On Hold"', () => {
    renderBadge(DemandStatus.ON_HOLD);
    expect(screen.getByText('On Hold')).toBeInTheDocument();
  });

  it('IN_EXECUTION renders "In Delivery"', () => {
    renderBadge(DemandStatus.IN_EXECUTION);
    expect(screen.getByText('In Delivery')).toBeInTheDocument();
  });

  it('COMPLETED renders "Completed"', () => {
    renderBadge(DemandStatus.COMPLETED);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('CANCELLED renders "Cancelled"', () => {
    renderBadge(DemandStatus.CANCELLED);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('isStalled=true renders orange "Stalled" badge alongside status badge', () => {
    renderBadge(DemandStatus.SUBMITTED, true);
    expect(screen.getByText('Pending DM Review')).toBeInTheDocument();
    expect(screen.getByText('Stalled')).toBeInTheDocument();
  });

  it('isStalled=false renders no "Stalled" badge', () => {
    renderBadge(DemandStatus.SUBMITTED, false);
    expect(screen.getByText('Pending DM Review')).toBeInTheDocument();
    expect(screen.queryByText('Stalled')).not.toBeInTheDocument();
  });

  it('default isStalled=undefined renders no "Stalled" badge', () => {
    renderBadge(DemandStatus.IN_REVIEW);
    expect(screen.queryByText('Stalled')).not.toBeInTheDocument();
  });
});
