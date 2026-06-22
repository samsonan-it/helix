import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ListTableCard } from './ListTableCard';

describe('ListTableCard', () => {
  it('renders children', () => {
    render(
      <MantineProvider>
        <ListTableCard>
          <table>
            <tbody>
              <tr>
                <td>cell content</td>
              </tr>
            </tbody>
          </table>
        </ListTableCard>
      </MantineProvider>,
    );
    expect(screen.getByText('cell content')).toBeInTheDocument();
  });

  it('applies list-table-card class for CSS header tinting', () => {
    const { container } = render(
      <MantineProvider>
        <ListTableCard>
          <div>inner</div>
        </ListTableCard>
      </MantineProvider>,
    );
    expect(container.querySelector('.list-table-card')).toBeInTheDocument();
  });

  it('sets overflow hidden for border-radius clipping', () => {
    const { container } = render(
      <MantineProvider>
        <ListTableCard>
          <div>inner</div>
        </ListTableCard>
      </MantineProvider>,
    );
    const paper = container.querySelector('.list-table-card') as HTMLElement;
    expect(paper.style.overflow).toBe('hidden');
  });
});
