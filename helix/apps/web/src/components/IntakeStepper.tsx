import { useCallback, useEffect, useRef } from 'react';
import { Stepper, Box } from '@mantine/core';
import { notifications } from '@mantine/notifications';

interface ParseableSchema {
  safeParse: (data: unknown) => {
    success: boolean;
    error?: { issues: Array<{ path: (string | number)[]; message: string }> };
  };
}

export interface StepConfig {
  label: string;
  description?: string;
  isBcStep?: boolean;
}

interface IntakeStepperProps {
  steps: StepConfig[];
  activeStep: number;
  onStepChange: (n: number) => void;
  onDraftSave: () => Promise<void>;
  /** One schema per step; undefined skips validation for that step */
  validationSchemas: (ParseableSchema | undefined)[];
  /** Return current form values to validate against schemas */
  getValues: () => Record<string, unknown>;
  /** Set a field error by name */
  setError: (name: string, error: { message: string }) => void;
  /** Controls whether steps with isBcStep=true are clickable */
  isBcStepEnabled: boolean;
  children: React.ReactNode;
}

const AUTOSAVE_INTERVAL_MS = 60_000;

export function IntakeStepper({
  steps,
  activeStep,
  onStepChange,
  onDraftSave,
  validationSchemas,
  getValues,
  setError,
  isBcStepEnabled,
  children,
}: IntakeStepperProps): JSX.Element {
  const saveRef = useRef(onDraftSave);
  saveRef.current = onDraftSave;

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        await saveRef.current();
      } catch {
        notifications.show({
          color: 'red',
          title: 'Draft not saved',
          message: 'Could not save your draft. Your work is safe — keep going.',
        });
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const handleStepClick = useCallback(
    (nextStep: number) => {
      const isAdvancing = nextStep > activeStep;
      if (isAdvancing) {
        const schema = validationSchemas[activeStep];
        if (schema) {
          const result = schema.safeParse(getValues());
          if (!result.success && result.error) {
            for (const issue of result.error.issues) {
              const field = issue.path.join('.') || (issue.path[0]?.toString() ?? '');
              if (field) setError(field, { message: issue.message });
            }
            return;
          }
        }
      }
      onStepChange(nextStep);
    },
    [activeStep, validationSchemas, getValues, setError, onStepChange],
  );

  return (
    <Box>
      <Stepper
        active={activeStep}
        onStepClick={handleStepClick}
        allowNextStepsSelect={true}
      >
        {steps.map((step) => (
          <Stepper.Step
            key={step.label}
            label={step.label}
            description={step.description}
            disabled={step.isBcStep === true && !isBcStepEnabled}
          />
        ))}
      </Stepper>
      <Box mt="xl">{children}</Box>
    </Box>
  );
}
