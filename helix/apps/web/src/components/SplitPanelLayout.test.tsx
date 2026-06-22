import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SplitPanelLayout } from './SplitPanelLayout';

const list = <div>List content</div>;
const detail = <div>Detail content</div>;

const originalInnerWidth = window.innerWidth;

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
});

function renderLayout(selectedId: string | null, windowWidth = 1280) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: windowWidth });
  return render(
    <MantineProvider>
      <SplitPanelLayout list={list} detail={detail} selectedId={selectedId} />
    </MantineProvider>,
  );
}

describe('SplitPanelLayout', () => {
  it('renders both list and detail panels at wide viewport', () => {
    renderLayout(null, 1280);
    expect(screen.getByText('List content')).toBeInTheDocument();
    expect(screen.getByText('Detail content')).toBeInTheDocument();
  });

  it('IC-9: at narrow viewport with no selection, shows list panel only', () => {
    renderLayout(null, 800);
    expect(screen.getByText('List content')).toBeInTheDocument();
    expect(screen.queryByText('Detail content')).not.toBeInTheDocument();
  });

  it('IC-9: at narrow viewport with selection, hides list and shows detail panel', () => {
    renderLayout('demand-1', 800);
    expect(screen.queryByText('List content')).not.toBeInTheDocument();
    expect(screen.getByText('Detail content')).toBeInTheDocument();
  });

  it('IC-9: back arrow renders in detail panel when onBack is provided at narrow viewport', () => {
    const onBack = vi.fn();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
    render(
      <MantineProvider>
        <SplitPanelLayout list={list} detail={detail} selectedId="d-1" onBack={onBack} />
      </MantineProvider>,
    );
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('detail panel has minWidth: 0 at wide viewport to prevent overflow', () => {
    const { container } = renderLayout('d-1', 1280);
    const detailBox = container.querySelector('[style*="min-width: 0"]');
    expect(detailBox).toBeInTheDocument();
  });
});
