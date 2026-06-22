import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AIFieldIndicator } from './AIFieldIndicator';

function wrap(ui: React.ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('AIFieldIndicator', () => {
  it('renders wrapper div and hint span when isAISuggested=true', () => {
    wrap(
      <AIFieldIndicator isAISuggested={true}>
        <input aria-label="title" />
      </AIFieldIndicator>,
    );
    expect(screen.getByText('AI suggested — review before submitting')).toBeTruthy();
    expect(screen.getByLabelText('title')).toBeTruthy();
  });

  it('renders children without wrapper when isAISuggested=false', () => {
    wrap(
      <AIFieldIndicator isAISuggested={false}>
        <input aria-label="title" />
      </AIFieldIndicator>,
    );
    expect(screen.queryByText('AI suggested — review before submitting')).toBeNull();
    expect(screen.getByLabelText('title')).toBeTruthy();
  });

  it('hint span is absent from DOM when isAISuggested=false', () => {
    const { container } = wrap(
      <AIFieldIndicator isAISuggested={false}>
        <span>child</span>
      </AIFieldIndicator>,
    );
    expect(container.querySelector('[id]')).toBeNull();
  });

  it('hint span is present in DOM when isAISuggested=true', () => {
    const { container } = wrap(
      <AIFieldIndicator isAISuggested={true}>
        <span>child</span>
      </AIFieldIndicator>,
    );
    const hint = container.querySelector('p[id]');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('AI suggested');
  });

  it('sets aria-describedby on child element when isAISuggested=true', () => {
    const { container } = wrap(
      <AIFieldIndicator isAISuggested={true}>
        <input aria-label="field" />
      </AIFieldIndicator>,
    );
    const hint = container.querySelector('[id]');
    const input = screen.getByLabelText('field');
    expect(hint).not.toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(hint?.id);
  });

  it('uses unique IDs across multiple instances', () => {
    const { container } = wrap(
      <>
        <AIFieldIndicator isAISuggested={true}><input aria-label="a" /></AIFieldIndicator>
        <AIFieldIndicator isAISuggested={true}><input aria-label="b" /></AIFieldIndicator>
      </>,
    );
    const hints = container.querySelectorAll('p[id]');
    expect(hints.length).toBe(2);
    expect(hints[0].id).not.toBe(hints[1].id);
  });
});
