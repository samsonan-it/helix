import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AIPrefillModal } from './AIPrefillModal';

function renderModal(props: Partial<React.ComponentProps<typeof AIPrefillModal>> = {}) {
  const defaults = {
    opened: true,
    isLoading: false,
    onCreateManually: vi.fn(),
    onPrefill: vi.fn(),
  };
  return render(
    <MantineProvider>
      <AIPrefillModal {...defaults} {...props} />
    </MantineProvider>,
  );
}

describe('AIPrefillModal', () => {
  it('renders modal title and description text', () => {
    renderModal();
    expect(screen.getByText('Prefill form with AI')).toBeTruthy();
    expect(screen.getByText(/Describe your project/i)).toBeTruthy();
  });

  it('"Prefill form" button is disabled when textarea is empty', () => {
    renderModal();
    const btn = screen.getByRole('button', { name: /prefill form/i });
    expect(btn).toBeTruthy();
    // Button should be disabled when no text
    expect(btn.hasAttribute('disabled') || btn.getAttribute('data-disabled') === 'true').toBe(true);
  });

  it('"Prefill form" button enables after typing text', () => {
    renderModal();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'some description' } });
    const btn = screen.getByRole('button', { name: /prefill form/i });
    expect(btn.hasAttribute('disabled') || btn.getAttribute('data-disabled') === 'true').toBe(false);
  });

  it('calls onPrefill with correct args when button clicked', () => {
    const onPrefill = vi.fn();
    renderModal({ onPrefill });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'my project description' } });
    const btn = screen.getByRole('button', { name: /prefill form/i });
    fireEvent.click(btn);
    expect(onPrefill).toHaveBeenCalledWith('my project description', false);
  });

  it('calls onCreateManually when "Create manually" clicked', () => {
    const onCreateManually = vi.fn();
    renderModal({ onCreateManually });
    fireEvent.click(screen.getByRole('button', { name: /create manually/i }));
    expect(onCreateManually).toHaveBeenCalledWith(false);
  });

  it('passes suppress=true to callbacks when checkbox is checked', () => {
    const onCreateManually = vi.fn();
    renderModal({ onCreateManually });
    const checkbox = screen.getByRole('checkbox', { name: /don't show/i });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /create manually/i }));
    expect(onCreateManually).toHaveBeenCalledWith(true);
  });

  it('disables inputs and buttons during isLoading', () => {
    renderModal({ isLoading: true });
    const textarea = screen.getByRole('textbox');
    expect(textarea.hasAttribute('disabled')).toBe(true);
    const createManuallyBtn = screen.getByRole('button', { name: /create manually/i });
    expect(createManuallyBtn.hasAttribute('disabled') || createManuallyBtn.getAttribute('data-disabled') === 'true').toBe(true);
  });

  it('shows "Analysing…" label on prefill button during isLoading', () => {
    renderModal({ isLoading: true });
    expect(screen.getByText('Analysing…')).toBeTruthy();
  });

  it('resets description to empty when modal opens', () => {
    renderModal({ opened: true });
    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });
});
