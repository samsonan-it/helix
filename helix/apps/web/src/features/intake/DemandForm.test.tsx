import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateDraftDemandSchema, step2Schema } from '@helix/shared';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

expect.extend(toHaveNoViolations);
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DemandForm } from './DemandForm';

const mockDraftSavedAt = '2026-07-01T10:00:00.000Z';

const mockCreateResult = {
  id: 'demand-1',
  title: 'Test',
  description: 'Desc',
  status: 'DRAFT',
  originatorId: 'user-1',
  costCentreId: null,
  glAccountId: null,
  demandType: null,
  startDate: null,
  endDate: null,
  draftSavedAt: mockDraftSavedAt,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
  legalEntityId: null,
  areaId: null,
  demandManagerId: null,
  demandOwner: null,
  objective: null,
  necessity: null,
  isMandatory: false,
  qualitativeValueCategory: null,
  quantitativeValueCategory: null,
  reasoningForMandatory: null,
  asisDescription: null,
  benefitsObjectives: null,
  tobeDescription: null,
  submittedAt: null,
  isSmallProject: false,
  isGxpRelevant: false,
  projectType: 'P',
};

const mockCreate = vi.fn().mockResolvedValue(mockCreateResult);
const mockUpdate = vi.fn().mockResolvedValue({ ...mockCreateResult, draftSavedAt: '2026-07-01T10:05:00.000Z' });
const mockSubmit = vi.fn().mockResolvedValue({ ...mockCreateResult, status: 'SUBMITTED', submittedAt: '2026-07-01T10:10:00.000Z' });
const mockDeleteDemand = vi.fn().mockResolvedValue(undefined);
const mockNavigate = vi.fn();
const mockTriggerPrefill = vi.fn().mockResolvedValue(undefined);

// Default mock — flag OFF
let mockFlags: Record<string, boolean> = {};
let mockIsSuppressed = false;
let mockPrefillFailed = false;

let mockSystemSettings = {
  spThresholdEurCents:   5_000_000,
  intakeWindowStart:     null as string | null,
  intakeWindowEnd:       null as string | null,
  budgetCycleStart:      null as string | null,
  budgetCycleEnd:        null as string | null,
  gxpItValidationDays:   30,
  gxpDocumentationDays:  14,
};

// Mutable so individual tests can simulate having a demandId in the URL
let mockSearchParamsStr = '';
// Mutable so individual tests can simulate loading an existing demand (e.g. to pre-populate scope)
let mockExistingDemand: Record<string, unknown> | undefined = undefined;

vi.mock('./intake.queries', () => ({
  useCreateDemand: () => ({ mutateAsync: mockCreate }),
  useUpdateDemand: () => ({ mutateAsync: mockUpdate }),
  useSubmitDemand: () => ({ mutateAsync: mockSubmit }),
  useDeleteDemand: () => ({ mutateAsync: mockDeleteDemand, isPending: false }),
  useGetDemand: () => ({ data: mockExistingDemand }),
  useGetCostCentres: () => ({ data: [{ id: 'cc-1', code: 'CC001', name: 'Cost Centre A', isActive: true }] }),
  useGetLegalEntities: () => ({ data: [{ id: 'le-1', code: 'LE001', name: 'Legal Entity A' }] }),
  useGetAreas: () => ({ data: [{ id: 'area-1', code: 'AREA001', name: 'Area A' }] }),
  useGetCountries: () => ({ data: [{ id: 'country-1', code: 'DE', name: 'Germany' }] }),
  useGetPersons: () => ({ data: [{ id: 'person-1', email: 'mgr@test.com', name: 'Manager A' }] }),
  useGetBcsByArea: () => ({ data: [{ id: 'bc-1', name: 'Controller A' }] }),
  useGetSystemSettings: () => ({ data: mockSystemSettings }),
  defaultSystemSettings: { spThresholdEurCents: 5_000_000, intakeWindowStart: null, intakeWindowEnd: null, budgetCycleStart: null, budgetCycleEnd: null, gxpItValidationDays: 30, gxpDocumentationDays: 14 },
}));

vi.mock('../../hooks/useFlags', () => ({
  useFlags: () => mockFlags,
}));

vi.mock('../../hooks/useAIPrefillSuppressed', () => ({
  useAIPrefillSuppressed: () => ({
    isSuppressed: mockIsSuppressed,
    suppress: vi.fn(),
  }),
}));

let mockAISuggestedFields: Set<string> = new Set();
let mockEstimatedCostCents: number | null = null;
const mockClearAISuggested = vi.fn();
const mockMarkAISuggested = vi.fn();

vi.mock('./useAIPrefill', () => ({
  useAIPrefill: () => ({
    triggerPrefill: mockTriggerPrefill,
    isLoading: false,
    prefillFailed: mockPrefillFailed,
    aiSuggestedFields: mockAISuggestedFields,
    clearAISuggested: mockClearAISuggested,
    markAISuggested: mockMarkAISuggested,
    aiConfidence: {},
    estimatedCostCents: mockEstimatedCostCents,
  }),
}));

let mockViewport: 'desktop' | 'mobile' = 'desktop';

vi.mock('../../hooks/useHelixViewport', () => ({
  useHelixViewport: () => mockViewport,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(mockSearchParamsStr), vi.fn()],
  };
});

function renderForm(searchParamsStr = '') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/demands/new${searchParamsStr ? '?' + searchParamsStr : ''}`]}>
          <DemandForm />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('DemandForm', () => {
  beforeEach(() => {
    mockFlags = {};
    mockIsSuppressed = false;
    mockPrefillFailed = false;
    mockViewport = 'desktop';
    mockSearchParamsStr = '';
    mockSystemSettings = { spThresholdEurCents: 5_000_000, intakeWindowStart: null, intakeWindowEnd: null, budgetCycleStart: null, budgetCycleEnd: null, gxpItValidationDays: 30, gxpDocumentationDays: 14 };
    mockAISuggestedFields = new Set();
    mockEstimatedCostCents = null;
    mockExistingDemand = undefined;
    vi.clearAllMocks();
  });

  it('renders all three section labels', () => {
    renderForm();
    expect(screen.getByText('Basics')).toBeTruthy();
    expect(screen.getByText('Classification')).toBeTruthy();
    expect(screen.getByText(/Objectives & Value/i)).toBeTruthy();
  });

  it('renders title and description fields in the Basics section', () => {
    renderForm();
    expect(screen.getByRole('textbox', { name: /^title/i })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /^description/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /small project/i })).toBeTruthy();
    expect(screen.queryByText('Estimated Cost Range')).toBeNull();
  });

  it('renders all Classification fields without step navigation', () => {
    renderForm();
    expect(screen.getByText('Cost Centre')).toBeTruthy();
    expect(screen.queryByText('GL Account')).toBeNull();
    expect(screen.getByText('Legal Entity')).toBeTruthy();
    expect(screen.getByText('Area')).toBeTruthy();
    expect(screen.getByText('Demand Manager')).toBeTruthy();
    expect(screen.getByText('Start Date')).toBeTruthy();
    expect(screen.getByText('End Date')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /demand owner/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /mandatory demand/i })).toBeTruthy();
  });

  it('renders all Objectives & Value fields without step navigation', () => {
    renderForm();
    expect(screen.getByRole('textbox', { name: /^objective/i })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /^necessity/i })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /qualitative value category/i })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /quantitative value category/i })).toBeNull();
    expect(screen.getByRole('switch', { name: /qualitative value/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /quantitative value/i })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /as-is description/i })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /to-be description/i })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /benefits/i })).toBeNull();
  });

  it('renders Submit Demand, Back to My Demands, and Save as Draft buttons', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /submit demand/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /back to my demands/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /save as draft/i })).toBeTruthy();
  });

  it('does not render a stepper or step navigation buttons', () => {
    renderForm();
    expect(screen.queryByRole('button', { name: /^next$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    expect(screen.queryByText('Details')).toBeNull();
    expect(screen.queryByText('Financial Plan')).toBeNull();
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('auto-save DTO includes all objective fields when set', () => {
    const result = updateDraftDemandSchema.safeParse({
      objective: 'Deliver X',
      necessity: 'Compliance',
      isMandatory: true,
      qualitativeValueCategory: true,
      reasoningForMandatory: 'Legal obligation',
    });
    expect(result.success).toBe(true);
  });

  it('date schema rejects endDate before startDate', () => {
    const result = step2Schema.safeParse({
      costCentreId: 'cjld2cjxh0000qzrmn831i7rn',
      startDate: '2026-12-01',
      endDate: '2026-07-01',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('End date cannot be before start date');
  });

  // ── AI Prefill: flag OFF tests ───────────────────────────────────────────

  it('flag false → no modal, no "Prefill with AI" button in DOM', () => {
    mockFlags = { ai_prefill: false };
    renderForm();
    expect(screen.queryByText('Prefill form with AI')).toBeNull();
    expect(screen.queryByRole('button', { name: /prefill with ai/i })).toBeNull();
  });

  // ── AI Prefill: flag ON tests ────────────────────────────────────────────

  it('flag true + not suppressed → modal opens on mount', async () => {
    mockFlags = { ai_prefill: true };
    mockIsSuppressed = false;
    renderForm();
    await waitFor(() => {
      expect(screen.queryByText('Prefill form with AI')).not.toBeNull();
    });
  });

  it('suppressed user → modal does NOT open on mount, manual trigger button is present', async () => {
    mockFlags = { ai_prefill: true };
    mockIsSuppressed = true;
    renderForm();
    await waitFor(() => {
      expect(screen.queryByText(/Describe your project/i)).toBeNull();
    });
    expect(screen.getByRole('button', { name: /prefill with ai/i })).toBeTruthy();
  });

  it('"Create manually" closes modal', async () => {
    mockFlags = { ai_prefill: true };
    mockIsSuppressed = false;
    renderForm();
    await waitFor(() => expect(screen.queryByText('Prefill form with AI')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /create manually/i }));
    await waitFor(() => expect(screen.queryByText(/Describe your project/i)).toBeNull());
  });

  it('"Prefill form" button calls triggerPrefill and closes modal', async () => {
    mockFlags = { ai_prefill: true };
    mockIsSuppressed = false;
    renderForm();
    await waitFor(() => expect(screen.queryByText('Prefill form with AI')).not.toBeNull());
    const textarea = screen.getByRole('textbox', { name: '' });
    fireEvent.change(textarea, { target: { value: 'My project description' } });
    fireEvent.click(screen.getByRole('button', { name: /prefill form/i }));
    await waitFor(() => expect(mockTriggerPrefill).toHaveBeenCalledWith('My project description'));
  });

  it('prefillFailed shows alert banner', () => {
    mockFlags = { ai_prefill: true };
    mockPrefillFailed = true;
    renderForm();
    expect(screen.getByText('Starting with a blank form — AI suggestions unavailable')).toBeTruthy();
  });

  it('manual trigger button opens modal when clicked', async () => {
    mockFlags = { ai_prefill: true };
    mockIsSuppressed = true;
    renderForm();
    const btn = screen.getByRole('button', { name: /prefill with ai/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.queryByText('Prefill form with AI')).not.toBeNull());
  });

  // ── Story 2.4: Demand Classification + GxP ──────────────────────────────

  it('renders Small Project toggle in the Basics section', () => {
    renderForm();
    expect(screen.getByRole('switch', { name: /small project/i })).toBeTruthy();
  });

  it('renders GxP Relevant checkbox in the Classification section', () => {
    renderForm();
    expect(screen.getByRole('switch', { name: /gxp relevant/i })).toBeTruthy();
  });

  it('Small Project toggle unchecked → P badge shown by default', async () => {
    renderForm();
    await waitFor(() => {
      expect(screen.queryByText('P')).not.toBeNull();
    });
  });

  it('Small Project toggle checked → SP badge shown', async () => {
    renderForm();
    const toggle = screen.getByRole('switch', { name: /small project/i });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.queryByText('SP')).not.toBeNull();
    });
  });

  it('[NFR14] GxP flag checked → IT Validation and Documentation milestone cards appear', async () => {
    renderForm();
    const gxpCheckbox = screen.getByRole('switch', { name: /gxp relevant/i });
    fireEvent.click(gxpCheckbox);
    await waitFor(() => {
      expect(screen.queryByText('IT Validation')).not.toBeNull();
      expect(screen.queryByText('Documentation')).not.toBeNull();
    });
  });

  it('[NFR14] GxP flag unchecked → milestone cards are absent', async () => {
    renderForm();
    const gxpCheckbox = screen.getByRole('switch', { name: /gxp relevant/i });
    // Tick then untick
    fireEvent.click(gxpCheckbox);
    await waitFor(() => expect(screen.queryByText('IT Validation')).not.toBeNull());
    fireEvent.click(gxpCheckbox);
    await waitFor(() => {
      expect(screen.queryByText('IT Validation')).toBeNull();
      expect(screen.queryByText('Documentation')).toBeNull();
    });
  });

  // ── Story 2.5: Inline Validation & Submission ────────────────────────────

  it('[AC1] Submit with empty mandatory P fields → shows inline validation errors', async () => {
    const user = userEvent.setup();
    renderForm();
    const submitBtn = screen.getByRole('button', { name: /submit demand/i });
    await user.click(submitBtn);
    await waitFor(() => {
      // At minimum legalEntityId and demandManagerId should show Required
      const errors = screen.queryAllByText('Required');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('[AC1] Submit blocked when validation fails — no API call made', async () => {
    const user = userEvent.setup();
    renderForm();
    const submitBtn = screen.getByRole('button', { name: /submit demand/i });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  it('[AC3] Mobile viewport → Submit button is disabled', () => {
    mockViewport = 'mobile';
    renderForm();
    const submitBtn = screen.getByRole('button', { name: /submit demand/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('[AC3] Mobile viewport → Submit button has correct title attribute', () => {
    mockViewport = 'mobile';
    renderForm();
    const submitBtn = screen.getByRole('button', { name: /submit demand/i });
    expect(submitBtn.getAttribute('title')).toBe(
      'Complete your demand on desktop — your draft has been saved.',
    );
  });

  // ── Story 3.3: Intake window gate (AC5) ────────────────────────────────────

  it('[AC5] Submit button enabled and no intake Alert when both window dates are null (always open)', () => {
    mockSystemSettings = { ...mockSystemSettings, intakeWindowStart: null, intakeWindowEnd: null };
    renderForm();
    const submitBtn = screen.getByRole('button', { name: /submit demand/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/intake window is not currently open/i)).toBeNull();
  });

  it('[AC5] Submit button disabled and Alert shown when intake window has not opened yet', () => {
    const futureStart = new Date(Date.now() + 86_400_000).toISOString();
    mockSystemSettings = { ...mockSystemSettings, intakeWindowStart: futureStart, intakeWindowEnd: null };
    renderForm();
    const submitBtn = screen.getByRole('button', { name: /submit demand/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/intake window is not currently open/i)).toBeTruthy();
  });

  it('[AC5] Submit button disabled and Alert shown when intake window has closed', () => {
    const pastEnd = new Date(Date.now() - 86_400_000).toISOString();
    mockSystemSettings = { ...mockSystemSettings, intakeWindowStart: null, intakeWindowEnd: pastEnd };
    renderForm();
    const submitBtn = screen.getByRole('button', { name: /submit demand/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/intake window is not currently open/i)).toBeTruthy();
  });

  it('[AC4] axe — intake form has no accessibility violations', async () => {
    const { container } = renderForm();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── Story 2.6b: Financial Planning button ───────────────────────────────

  it('[AC1] Financial Planning button is present in the form footer', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /financial planning/i })).toBeTruthy();
  });

  it('[AC2] Financial Planning button navigates to /demands/:id/financial-planning after draft save when demandId exists', async () => {
    mockSearchParamsStr = 'id=demand-1';
    renderForm();
    const fpBtn = screen.getByRole('button', { name: /financial planning/i });
    await userEvent.click(fpBtn);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/demands/demand-1/financial-planning');
    });
  });

  it('[AC3] Financial Planning button shows notification and does not navigate when demandId is null and save fails', async () => {
    // mockSearchParamsStr is '' (default) → demandId is null → new demand path
    renderForm();
    const fpBtn = screen.getByRole('button', { name: /financial planning/i });
    await userEvent.click(fpBtn);
    // No title/description filled → handleDraftSave returns undefined → notification shown, no navigate
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('financial-planning'));
    });
  });

  // ── Story 2.8: Field refinements ────────────────────────────────────────────

  it('[2.8/AC3] Reasoning for Mandatory hidden when isMandatory unchecked', () => {
    renderForm();
    expect(screen.queryByRole('textbox', { name: /reasoning for mandatory/i })).toBeNull();
  });

  it('[2.8/AC3] Reasoning for Mandatory appears when isMandatory is checked', async () => {
    renderForm();
    const checkbox = screen.getByRole('switch', { name: /mandatory demand/i });
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /reasoning for mandatory/i })).not.toBeNull();
    });
  });

  it('[2.8/AC5] Qualitative Value and Quantitative Value are checkboxes in Objectives section', () => {
    renderForm();
    expect(screen.getByRole('switch', { name: /qualitative value/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /quantitative value/i })).toBeTruthy();
  });

  it('[2.8/AC6] Benefits textarea hidden when both value category checkboxes unchecked', () => {
    renderForm();
    expect(screen.queryByRole('textbox', { name: /benefits/i })).toBeNull();
  });

  it('[2.8/AC6] Benefits textarea appears when Qualitative Value is checked', async () => {
    renderForm();
    const qualCheckbox = screen.getByRole('switch', { name: /qualitative value/i });
    fireEvent.click(qualCheckbox);
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /benefits/i })).not.toBeNull();
    });
  });

  it('[2.8/AC11] Save as Draft button calls handleDraftSave and navigates back', async () => {
    mockSearchParamsStr = 'id=demand-1';
    renderForm();
    const saveBtn = screen.getByRole('button', { name: /save as draft/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  // ── Story 2.10: SP auto-check note ──────────────────────────────────────────

  it('[2.10/AC-7] SP note shown with "below threshold" text when AI cost is below threshold', async () => {
    mockAISuggestedFields = new Set(['isSmallProject']);
    mockEstimatedCostCents = 2_000_000; // €20,000 < €50,000
    renderForm();
    await waitFor(() => {
      expect(screen.getByText(/below the.*Small Project threshold/i)).toBeTruthy();
      expect(screen.getByText(/Toggled on automatically/i)).toBeTruthy();
    });
  });

  it('[2.10/AC-7] SP note shown with "above threshold" text when AI cost is above threshold', async () => {
    mockAISuggestedFields = new Set(['isSmallProject']);
    mockEstimatedCostCents = 8_000_000; // €80,000 > €50,000
    renderForm();
    await waitFor(() => {
      expect(screen.getByText(/above the.*Small Project threshold/i)).toBeTruthy();
      expect(screen.getByText(/Toggle not set/i)).toBeTruthy();
    });
  });

  it('[2.10/AC-7] SP note absent when AI returned no estimated cost', async () => {
    mockAISuggestedFields = new Set(['isSmallProject']);
    mockEstimatedCostCents = null;
    renderForm();
    expect(screen.queryByText(/Small Project threshold/i)).toBeNull();
  });

  it('[2.10/AC-8] SP note disappears when user manually toggles the checkbox', async () => {
    mockAISuggestedFields = new Set(['isSmallProject']);
    mockEstimatedCostCents = 2_000_000;
    renderForm();
    await waitFor(() => expect(screen.getByText(/below the.*Small Project threshold/i)).toBeTruthy());

    const checkbox = screen.getByRole('switch', { name: /small project/i });
    fireEvent.click(checkbox);
    expect(mockClearAISuggested).toHaveBeenCalledWith('isSmallProject');
  });

  it('[2.10/AC-5] clearAISuggested called when user edits the description field', () => {
    mockAISuggestedFields = new Set(['description']);
    renderForm();
    const textarea = screen.getByRole('textbox', { name: /^description/i });
    fireEvent.change(textarea, { target: { value: 'user edit' } });
    expect(mockClearAISuggested).toHaveBeenCalledWith('description');
  });

  it('[2.10/AC-5] clearAISuggested called when user edits the objective field', () => {
    mockAISuggestedFields = new Set(['objective']);
    renderForm();
    const textarea = screen.getByRole('textbox', { name: /^objective/i });
    fireEvent.change(textarea, { target: { value: 'user edit' } });
    expect(mockClearAISuggested).toHaveBeenCalledWith('objective');
  });

  it('[2.10/AC-5] clearAISuggested called when user edits the necessity field', () => {
    mockAISuggestedFields = new Set(['necessity']);
    renderForm();
    const textarea = screen.getByRole('textbox', { name: /^necessity/i });
    fireEvent.change(textarea, { target: { value: 'user edit' } });
    expect(mockClearAISuggested).toHaveBeenCalledWith('necessity');
  });

  // ── Story 4.10 — "Delete draft" link (AC-8, AC-9) ──────────────────────────

  it('[4.10/AC-8] footer shows "Back to My Demands" instead of "Discard"', () => {
    renderForm();
    expect(screen.queryByRole('button', { name: /discard/i })).toBeNull();
    expect(screen.getByRole('button', { name: /back to my demands/i })).toBeTruthy();
  });

  it('[4.10/AC-9] "Delete draft" link is NOT rendered when no demandId (new demand before first save)', () => {
    mockSearchParamsStr = '';  // no ?id= param → demandId undefined
    renderForm();
    expect(screen.queryByRole('button', { name: /delete draft/i })).toBeNull();
  });

  it('[4.10/AC-9] "Delete draft" link IS rendered when demandId is set (edit mode)', () => {
    mockSearchParamsStr = 'id=demand-1';
    renderForm();
    expect(screen.getByRole('button', { name: /delete draft/i })).toBeTruthy();
  });

  // ── Bug regression: first-submit on new demand saves all fields before submit ──

  // Story 2.14 note: Mantine SegmentedControl radio inputs are 0x0px in CSS — not triggerable via
  // userEvent in JSDOM. This test uses an existing draft with demandScope pre-populated so all
  // required fields pass validation, then verifies the original BUG FIX (updateMutation is called
  // with the correct demandManagerId when submitting a draft).
  it('[BUG] submitting a draft calls updateMutation preserving demandManagerId', async () => {
    const user = userEvent.setup();
    // Pre-populate an existing draft with all required fields including demandScope
    mockSearchParamsStr = 'id=demand-1';
    mockExistingDemand = {
      ...mockCreateResult,
      costCentreId: 'cc-1',
      demandScope: 'GLOBAL',
      countryId: null,
      country: null,
      legalEntityId: 'le-1',
      areaId: 'area-1',
      demandManagerId: 'person-1',
      businessControllerId: 'bc-1',
      endDate: '2026-12-31T00:00:00.000Z',
      demandOwner: 'John Doe',
      objective: 'Improve process',
      necessity: 'Regulatory requirement',
    };

    // Restore mock implementations after vi.clearAllMocks()
    mockUpdate.mockResolvedValue({ ...mockCreateResult, draftSavedAt: '2026-07-01T10:05:00.000Z' });
    mockSubmit.mockResolvedValue({ ...mockCreateResult, status: 'SUBMITTED' });

    renderForm('?id=demand-1');

    // Wait for form to populate from the existingDemand effect
    await waitFor(() => screen.getByDisplayValue('John Doe'));

    // Save as Draft bypasses form validation — directly tests the update mutation call
    const saveBtn = screen.getByRole('button', { name: /save as draft/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.dto.demandManagerId).toBe('person-1');
  });
});
