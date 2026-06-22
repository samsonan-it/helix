import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { CopyLinkButton } from './CopyLinkButton';

function renderButton() {
  return render(
    <MantineProvider>
      <CopyLinkButton />
    </MantineProvider>,
  );
}

describe('CopyLinkButton', () => {
  it('renders with aria-label "Copy link"', () => {
    renderButton();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });
});
