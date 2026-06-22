import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { PageHeader } from './PageHeader';

function renderHeader(props: Partial<React.ComponentProps<typeof PageHeader>> & { title: string }) {
  return render(
    <MantineProvider>
      <PageHeader {...props} />
    </MantineProvider>,
  );
}

describe('PageHeader', () => {
  it('renders exactly one H2 with the title', () => {
    renderHeader({ title: 'My Page' });
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s).toHaveLength(1);
    expect(h2s[0]).toHaveTextContent('My Page');
  });

  it('renders subtitle when provided', () => {
    renderHeader({ title: 'My Page', subtitle: 'A subtitle' });
    expect(screen.getByText('A subtitle')).toBeInTheDocument();
  });

  it('renders actions slot when provided', () => {
    renderHeader({ title: 'My Page', actions: <button>New Item</button> });
    expect(screen.getByRole('button', { name: 'New Item' })).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    renderHeader({ title: 'My Page', icon: <span data-testid="icon" /> });
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render subtitle when omitted', () => {
    const { queryByRole } = renderHeader({ title: 'My Page' });
    // No paragraph/text with dimmed treatment beyond the title
    expect(screen.queryByText('A subtitle')).not.toBeInTheDocument();
    expect(queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
