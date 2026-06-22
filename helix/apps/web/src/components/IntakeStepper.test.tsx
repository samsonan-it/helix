import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { IntakeStepper, StepConfig } from './IntakeStepper';

const steps: StepConfig[] = [
  { label: 'Description' },
  { label: 'Details', isBcStep: true },
  { label: 'Financial Plan' },
  { label: 'Review' },
];

const passSchema = {
  safeParse: () => ({ success: true as const }),
};

const failSchema = {
  safeParse: () => ({
    success: false as const,
    error: {
      issues: [{ path: ['title'], message: 'Title is required' }],
    },
  }),
};

function renderStepper(overrides: {
  activeStep?: number;
  onStepChange?: ReturnType<typeof vi.fn>;
  onDraftSave?: ReturnType<typeof vi.fn>;
  validationSchemas?: (typeof passSchema | typeof failSchema | undefined)[];
  getValues?: () => Record<string, unknown>;
  setError?: ReturnType<typeof vi.fn>;
  isBcStepEnabled?: boolean;
}) {
  const props = {
    steps,
    activeStep: overrides.activeStep ?? 0,
    onStepChange: overrides.onStepChange ?? vi.fn(),
    onDraftSave: overrides.onDraftSave ?? vi.fn().mockResolvedValue(undefined),
    validationSchemas: overrides.validationSchemas ?? [passSchema, passSchema, undefined, undefined],
    getValues: overrides.getValues ?? (() => ({ title: 'Test', description: 'Desc' })),
    setError: overrides.setError ?? vi.fn(),
    isBcStepEnabled: overrides.isBcStepEnabled ?? false,
  };

  return render(
    <MantineProvider>
      <Notifications />
      <IntakeStepper {...props}>
        <div>Step content</div>
      </IntakeStepper>
    </MantineProvider>,
  );
}

describe('IntakeStepper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all step labels', () => {
    renderStepper({});
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByText('Financial Plan')).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
  });

  it('renders children below the stepper', () => {
    renderStepper({});
    expect(screen.getByText('Step content')).toBeTruthy();
  });

  it('fires onDraftSave after 60 seconds', async () => {
    const onDraftSave = vi.fn().mockResolvedValue(undefined);
    renderStepper({ onDraftSave });

    expect(onDraftSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(onDraftSave).toHaveBeenCalledTimes(1);
  });

  it('fires onDraftSave twice after 120 seconds', async () => {
    const onDraftSave = vi.fn().mockResolvedValue(undefined);
    renderStepper({ onDraftSave });

    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });

    expect(onDraftSave).toHaveBeenCalledTimes(2);
  });

  it('shows notification on draft save failure but does not block form', async () => {
    const onDraftSave = vi.fn().mockRejectedValue(new Error('network error'));
    renderStepper({ onDraftSave });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(onDraftSave).toHaveBeenCalledTimes(1);
    // Notification is rendered — title text appears in DOM
    expect(screen.getByText('Draft not saved')).toBeTruthy();
    // Step content still visible — form is not blocked
    expect(screen.getByText('Step content')).toBeTruthy();
  });

  it('blocks step advance and calls setError when validation fails', async () => {
    const onStepChange = vi.fn();
    const setError = vi.fn();
    renderStepper({
      activeStep: 0,
      validationSchemas: [failSchema, undefined, undefined, undefined],
      onStepChange,
      setError,
      getValues: () => ({ title: '' }),
      isBcStepEnabled: true,
    });

    // Click on step index 1 (Details) to attempt advance
    const detailsStep = screen.getByText('Details');
    await act(async () => {
      fireEvent.click(detailsStep);
    });

    expect(onStepChange).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('title', { message: 'Title is required' });
  });

  it('allows step advance when validation passes', async () => {
    const onStepChange = vi.fn();
    renderStepper({
      activeStep: 0,
      validationSchemas: [passSchema, undefined, undefined, undefined],
      onStepChange,
      isBcStepEnabled: true,
    });

    const detailsStep = screen.getByText('Details');
    await act(async () => {
      fireEvent.click(detailsStep);
    });

    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  describe('BC step gating', () => {
    it('renders BC step with disabled attribute when isBcStepEnabled=false', () => {
      renderStepper({ isBcStepEnabled: false });
      // The BC step button should have aria-disabled or disabled
      const buttons = screen.getAllByRole('button');
      // "Details" is the BC step (index 1) — find by label
      const detailsButton = buttons.find((btn) => btn.textContent?.includes('Details'));
      expect(detailsButton).toBeDefined();
      // Mantine marks disabled steps — button should be disabled or aria-disabled
      const isDisabled =
        detailsButton?.getAttribute('disabled') !== null ||
        detailsButton?.getAttribute('aria-disabled') === 'true';
      expect(isDisabled).toBe(true);
    });

    it('renders BC step as enabled when isBcStepEnabled=true', () => {
      renderStepper({ isBcStepEnabled: true });
      const buttons = screen.getAllByRole('button');
      const detailsButton = buttons.find((btn) => btn.textContent?.includes('Details'));
      expect(detailsButton).toBeDefined();
      const isDisabled =
        detailsButton?.getAttribute('disabled') !== null &&
        detailsButton?.getAttribute('aria-disabled') === 'true';
      expect(isDisabled).toBe(false);
    });
  });
});
