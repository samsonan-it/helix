import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { PageLayout } from './PageLayout';

function renderLayout(props: { fullWidth?: boolean } = {}) {
  return render(
    <MantineProvider>
      <PageLayout {...props}>
        <div>page content</div>
      </PageLayout>
    </MantineProvider>,
  );
}

describe('PageLayout', () => {
  it('renders children', () => {
    renderLayout();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('applies max-width constraint when fullWidth is false (default)', () => {
    renderLayout();
    const box = screen.getByTestId('page-layout');
    const style = box.getAttribute('style') ?? '';
    expect(style).toMatch(/max-width:\s*1440px/);
    expect(style).toMatch(/margin-left:\s*auto/);
    expect(style).toMatch(/margin-right:\s*auto/);
  });

  it('omits max-width when fullWidth is true', () => {
    renderLayout({ fullWidth: true });
    const box = screen.getByTestId('page-layout');
    expect(box.getAttribute('style') ?? '').not.toContain('1440');
    expect(box).toHaveAttribute('data-full-width', 'true');
  });

  it('always applies min-width 800px', () => {
    renderLayout();
    const box = screen.getByTestId('page-layout');
    expect(box.getAttribute('style') ?? '').toMatch(/min-width:\s*800px/);
  });
});
