import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DemandTypeIndicator } from './DemandTypeIndicator';

function renderIndicator(type: 'P' | 'SP' | null) {
  return render(
    <MantineProvider>
      <DemandTypeIndicator type={type} />
    </MantineProvider>,
  );
}

describe('DemandTypeIndicator', () => {
  it('renders nothing when type is null', () => {
    renderIndicator(null);
    expect(screen.queryByText('SP')).toBeNull();
    expect(screen.queryByText('P')).toBeNull();
  });

  it('renders "P" label when type is "P"', () => {
    renderIndicator('P');
    expect(screen.getByText('P')).toBeTruthy();
  });

  it('renders "SP" label when type is "SP"', () => {
    renderIndicator('SP');
    expect(screen.getByText('SP')).toBeTruthy();
  });
});
