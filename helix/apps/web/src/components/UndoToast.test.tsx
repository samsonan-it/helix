import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { UndoToast } from './UndoToast';

function renderToast(overrides: {
  onUndo?: () => void;
  duration?: number;
}) {
  return render(
    <MantineProvider>
      <UndoToast
        message="Demand accepted"
        onUndo={overrides.onUndo ?? vi.fn()}
        duration={overrides.duration ?? 8000}
      />
    </MantineProvider>,
  );
}

describe('UndoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the message and countdown', () => {
    renderToast({});
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Demand accepted')).toBeInTheDocument();
    expect(screen.getByText(/8s/)).toBeInTheDocument();
  });

  it('AC-UNDOTOAST-01: clicking Undo fires onUndo', async () => {
    const onUndo = vi.fn();
    renderToast({ onUndo, duration: 8000 });

    fireEvent.click(screen.getByRole('button', { name: /undo/i }));

    await act(async () => {
      vi.advanceTimersByTime(9000);
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('countdown decrements over time', async () => {
    renderToast({ duration: 8000 });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText(/5s/)).toBeInTheDocument();
  });

  it('countdown span has aria-live="off"', () => {
    renderToast({});
    const countdownSpan = screen.getByText(/8s/).closest('[aria-live]');
    expect(countdownSpan).toHaveAttribute('aria-live', 'off');
  });
});
