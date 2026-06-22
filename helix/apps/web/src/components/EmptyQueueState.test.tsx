import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { EmptyQueueState } from './EmptyQueueState';

function renderState(type: 'empty' | 'filtered', onClearFilter?: () => void) {
  return render(
    <MantineProvider>
      <EmptyQueueState type={type} onClearFilter={onClearFilter} />
    </MantineProvider>,
  );
}

describe('EmptyQueueState', () => {
  it('renders role="status" and aria-live="polite"', () => {
    renderState('empty');
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('type="empty" shows queue clear message', () => {
    renderState('empty');
    expect(screen.getByText(/queue clear/i)).toBeInTheDocument();
  });

  it('type="filtered" shows "nothing matches" message', () => {
    renderState('filtered');
    expect(screen.getByText(/no demands match/i)).toBeInTheDocument();
  });

  it('type="filtered" renders "Clear filter" CTA when onClearFilter provided', () => {
    const onClear = vi.fn();
    renderState('filtered', onClear);
    const btn = screen.getByRole('button', { name: /clear filter/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('type="empty" does NOT render "Clear filter" CTA', () => {
    renderState('empty');
    expect(screen.queryByRole('button', { name: /clear filter/i })).not.toBeInTheDocument();
  });

  it('type="filtered" without onClearFilter does not render the CTA', () => {
    renderState('filtered');
    expect(screen.queryByRole('button', { name: /clear filter/i })).not.toBeInTheDocument();
  });
});
