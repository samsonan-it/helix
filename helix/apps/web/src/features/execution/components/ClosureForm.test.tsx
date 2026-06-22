import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClosureForm } from './ClosureForm';
import { type ProjectDetail } from '../api/execution.api';

const uploadMutate = vi.fn();
const submitMutate = vi.fn();

vi.mock('../hooks/useUploadHandoverDocument', () => ({
  useUploadHandoverDocument: () => ({ mutate: uploadMutate, isPending: false }),
}));

vi.mock('../hooks/useSubmitClosure', () => ({
  useSubmitClosure: () => ({ mutate: submitMutate, isPending: false }),
}));

const baseProject: ProjectDetail = {
  id: 'proj-1',
  demandId: 'dem-1',
  title: 'Alpha Project',
  demandType: 'P',
  startDate: null,
  endDate: null,
  overallRag: null,
  status: 'PREPARE_FOR_CLOSURE',
  currentStage: null,
  assignedPmId: 'pm-1',
  assignedPmName: 'Alice PM',
  description: null,
  businessCase: null,
  asIsDescription: null,
  toBeDescription: null,
  projectType: null,
  investmentApproval: null,
  demandScope: null,
  isSmallProject: false,
  publicId: 42,
  createdAt: '2026-06-01T00:00:00.000Z',
  objective: null,
  necessity: null,
  gxpRelevant: null,
  eaInvolved: null,
  eaComment: null,
  itSecurityInvolved: null,
  itSecurityComment: null,
  scope: null,
  depsAssumptionsRisk: null,
  appPlatformOwner: null,
  businessPm: null,
  businessSponsor: null,
  icRecharge: null,
  icRechargeAlignmentConducted: null,
  archImpact: null,
  eaAlignmentConducted: null,
  itSecurityAlignmentConducted: null,
  maintenanceL1: null,
  maintenanceL2: null,
  maintenanceL3: null,
  licensesNeeded: null,
  licenseCostCents: null,
  licenseExpectedUsers: null,
  licenseMetric: null,
  licenseInBudget: null,
  qualitativeValue: null,
  quantitativeValue: null,
  valueCaseDescription: null,
  charterSubmittedAt: null,
  closureWorkDelivered: null,
  closureFinancialReconciled: null,
  closureHandoverDocumentPath: null,
  closurePmSummaryNotes: null,
  closureSubmittedAt: null,
  demandManagerId: null,
  opexInternalOrder: null,
  capexInternalOrder: null,
};

function renderForm(project: ProjectDetail, isActor = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider>
        <ClosureForm project={project} isActor={isActor} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('ClosureForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows read-only summary when closureSubmittedAt is set', () => {
    renderForm({ ...baseProject, closureSubmittedAt: '2026-06-17T10:00:00.000Z' });
    expect(screen.getByText(/Closure submitted/i)).toBeTruthy();
    expect(screen.queryByText(/Submit Closure/i)).toBeNull();
  });

  it('renders the form when closureSubmittedAt is null', () => {
    renderForm(baseProject);
    expect(screen.getAllByText(/Work delivered/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Financial reconciliation/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Submit Closure/i })).toBeTruthy();
  });

  it('Submit button is disabled when no checkboxes checked and no file', () => {
    renderForm(baseProject);
    const btn = screen.getByRole('button', { name: /Submit Closure/i });
    expect(btn).toBeDisabled();
  });

  it('Submit button is disabled when only one checkbox checked', () => {
    renderForm(baseProject);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    const btn = screen.getByRole('button', { name: /Submit Closure/i });
    expect(btn).toBeDisabled();
  });

  it('shows missing items hint when form is incomplete', () => {
    renderForm(baseProject);
    expect(screen.getByText(/Still required/i)).toBeTruthy();
  });

  it('does not show Submit button when isActor is false', () => {
    renderForm(baseProject, false);
    expect(screen.queryByRole('button', { name: /Submit Closure/i })).toBeNull();
  });
});
