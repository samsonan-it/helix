import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { RoteEcke } from './RoteEcke';

function renderComponent() {
  return render(
    <MantineProvider>
      <RoteEcke />
    </MantineProvider>,
  );
}

describe('RoteEcke', () => {
  it('renders with rote-ecke CSS class', () => {
    const { container } = renderComponent();
    const el = container.querySelector('.rote-ecke');
    expect(el).not.toBeNull();
  });

  it('has aria-hidden="true" — purely decorative', () => {
    const { container } = renderComponent();
    const el = container.querySelector('.rote-ecke');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders no child content', () => {
    const { container } = renderComponent();
    const el = container.querySelector('.rote-ecke');
    expect(el?.textContent).toBe('');
  });
});
