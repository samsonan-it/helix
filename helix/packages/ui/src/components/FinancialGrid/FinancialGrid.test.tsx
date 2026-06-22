import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render as tlRender, screen, fireEvent, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { FinancialGrid, deriveVisibleColumns } from './FinancialGrid';
import type { GridGlAccount, GridEntry } from './FinancialGrid';

function render(ui: React.ReactElement, options?: RenderOptions) {
  return tlRender(ui, {
    wrapper: ({ children }) => <MantineProvider>{children}</MantineProvider>,
    ...options,
  });
}

const makeGlAccount = (
  id: string,
  category: GridGlAccount['category'],
  label: string,
): GridGlAccount => ({ id, category, label, isActive: true });

const makeEntry = (
  glAccountId: string,
  month: number,
  year: number,
  overrides: Partial<GridEntry> = {},
): GridEntry => ({
  glAccountId,
  category: 'opex',
  month,
  year,
  valueCents: 0,
  isActual: false,
  isUserSet: false,
  ...overrides,
});

const DEFAULT_GL_ACCOUNTS: GridGlAccount[] = [
  makeGlAccount('benefits-1', 'benefits', 'Cost savings'),
  makeGlAccount('benefits-2', 'benefits', 'Profit increase'),
  makeGlAccount('opex-1', 'opex', 'Hosting'),
  makeGlAccount('capex-1', 'capex', 'Hardware'),
];

function makeDefaultGrid(overrides: Partial<Parameters<typeof FinancialGrid>[0]> = {}) {
  return (
    <FinancialGrid
      glAccounts={DEFAULT_GL_ACCOUNTS}
      entries={[]}
      onCellChange={vi.fn()}
      startDate="2026-04-01"
      endDate="2026-09-30"
      {...overrides}
    />
  );
}

// ─── deriveVisibleColumns ────────────────────────────────────────────────────

describe('[AC28] deriveVisibleColumns helper', () => {
  it('same-year range: Apr–Sep 2026 → 6 columns all with year 2026', () => {
    const cols = deriveVisibleColumns('2026-04-01', '2026-09-30');
    expect(cols).toHaveLength(6);
    expect(cols[0]).toEqual({ year: 2026, month: 4 });
    expect(cols[5]).toEqual({ year: 2026, month: 9 });
    expect(cols.every((c) => c.year === 2026)).toBe(true);
  });

  it('cross-year range: Oct 2026–Mar 2027 → 6 columns with correct years', () => {
    const cols = deriveVisibleColumns('2026-10-01', '2027-03-31');
    expect(cols).toHaveLength(6);
    expect(cols[0]).toEqual({ year: 2026, month: 10 });
    expect(cols[1]).toEqual({ year: 2026, month: 11 });
    expect(cols[2]).toEqual({ year: 2026, month: 12 });
    expect(cols[3]).toEqual({ year: 2027, month: 1 });
    expect(cols[4]).toEqual({ year: 2027, month: 2 });
    expect(cols[5]).toEqual({ year: 2027, month: 3 });
  });

  it('no dates (undefined, undefined): backward-compat returns all 12 months Jan–Dec', () => {
    const today = new Date('2026-06-15');
    const cols = deriveVisibleColumns(undefined, undefined, today);
    expect(cols).toHaveLength(12);
    expect(cols[0]).toEqual({ year: 2026, month: 1 });
    expect(cols[11]).toEqual({ year: 2026, month: 12 });
  });

  it('no dates (null, null): page path — current month through Dec of current year', () => {
    const today = new Date('2026-06-15');
    const cols = deriveVisibleColumns(null, null, today);
    expect(cols).toHaveLength(7);
    expect(cols[0]).toEqual({ year: 2026, month: 6 });
    expect(cols[6]).toEqual({ year: 2026, month: 12 });
  });

  it('no endDate: current month through Dec of start year', () => {
    const cols = deriveVisibleColumns('2026-05-01', null);
    expect(cols).toHaveLength(8);
    expect(cols[0]).toEqual({ year: 2026, month: 5 });
    expect(cols[7]).toEqual({ year: 2026, month: 12 });
  });
});

// ─── Year header row ─────────────────────────────────────────────────────────

describe('[AC5] year header row', () => {
  it('cross-year: "2026" and "2027" year columns rendered as collapsible buttons', () => {
    render(makeDefaultGrid({ startDate: '2026-10-01', endDate: '2027-03-31' }));
    const year2026 = screen.getByRole('button', { name: /2026,/ });
    const year2027 = screen.getByRole('button', { name: /2027,/ });
    expect(year2026).toBeTruthy();
    expect(year2027).toBeTruthy();
    expect(year2026).toHaveAttribute('aria-expanded', 'true');
    expect(year2027).toHaveAttribute('aria-expanded', 'true');
  });

  it('single-year: year header column rendered as collapsible button', () => {
    render(makeDefaultGrid());
    const yearButton = screen.getByRole('button', { name: /2026,/ });
    expect(yearButton).toBeTruthy();
    expect(yearButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking year header collapses its month columns', () => {
    render(makeDefaultGrid({ startDate: '2026-10-01', endDate: '2027-03-31' }));
    expect(screen.getByText('Oct')).toBeTruthy();
    const year2026Button = screen.getByRole('button', { name: /2026,/ });
    fireEvent.click(year2026Button);
    expect(screen.queryByText('Oct')).toBeNull();
    expect(screen.queryByText('Nov')).toBeNull();
    expect(screen.getByText('Jan')).toBeTruthy();
    expect(year2026Button).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking year header twice re-expands month columns', () => {
    render(makeDefaultGrid());
    const yearButton = screen.getByRole('button', { name: /2026,/ });
    fireEvent.click(yearButton);
    expect(screen.queryByText('Apr')).toBeNull();
    fireEvent.click(yearButton);
    expect(screen.getByText('Apr')).toBeTruthy();
  });

  it('Space key collapses year months', () => {
    render(makeDefaultGrid());
    const yearButton = screen.getByRole('button', { name: /2026,/ });
    fireEvent.keyDown(yearButton, { key: ' ' });
    expect(screen.queryByText('Apr')).toBeNull();
  });

  it('Enter key collapses year months', () => {
    render(makeDefaultGrid());
    const yearButton = screen.getByRole('button', { name: /2026,/ });
    fireEvent.keyDown(yearButton, { key: 'Enter' });
    expect(screen.queryByText('Apr')).toBeNull();
  });
});

// ─── Month header row ─────────────────────────────────────────────────────────

describe('[AC4] cross-year: month headers show correct abbreviations without year prefix', () => {
  it('Oct, Nov, Dec, Jan, Feb, Mar all present for Oct 2026–Mar 2027', () => {
    render(makeDefaultGrid({ startDate: '2026-10-01', endDate: '2027-03-31' }));
    ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].forEach((m) => {
      expect(screen.getByText(m)).toBeTruthy();
    });
    expect(screen.queryByText('Sep')).toBeNull();
  });
});

// ─── Three sections always present ───────────────────────────────────────────

describe('[AC10] three section header rows always present', () => {
  it('shows Benefits, OPEX and CAPEX regardless of demand type', () => {
    render(makeDefaultGrid());
    expect(screen.getByText('Benefits')).toBeTruthy();
    expect(screen.getByText('OPEX')).toBeTruthy();
    expect(screen.getByText('CAPEX')).toBeTruthy();
  });
});

// ─── Detail rows ordered alphabetically ──────────────────────────────────────

describe('[AC11] detail rows alphabetical within section', () => {
  it('Benefits rows: Cost savings before Profit increase', () => {
    render(makeDefaultGrid());
    const rows = screen.getAllByRole('row');
    const rowTexts = rows.map((r) => r.textContent ?? '');
    const costSavingsIdx = rowTexts.findIndex((t) => t.includes('Cost savings'));
    const profitIncreaseIdx = rowTexts.findIndex((t) => t.includes('Profit increase'));
    expect(costSavingsIdx).toBeLessThan(profitIncreaseIdx);
  });
});

// ─── Section collapse/expand ──────────────────────────────────────────────────

describe('[AC16] section collapse toggle', () => {
  it('clicking Benefits hides detail rows and shows chevron right', () => {
    render(makeDefaultGrid());
    expect(screen.getByText('Cost savings')).toBeTruthy();

    const benefitsRow = screen.getByText('Benefits').closest('tr');
    fireEvent.click(benefitsRow!);

    expect(screen.queryByText('Cost savings')).toBeNull();
  });

  it('clicking Benefits twice re-shows detail rows', () => {
    render(makeDefaultGrid());
    const benefitsRow = screen.getByText('Benefits').closest('tr');
    fireEvent.click(benefitsRow!);
    expect(screen.queryByText('Cost savings')).toBeNull();
    fireEvent.click(benefitsRow!);
    expect(screen.getByText('Cost savings')).toBeTruthy();
  });

  it('[AC16] Space key collapses section', () => {
    render(makeDefaultGrid());
    const benefitsRow = screen.getByText('Benefits').closest('tr');
    fireEvent.keyDown(benefitsRow!, { key: ' ' });
    expect(screen.queryByText('Cost savings')).toBeNull();
  });

  it('[AC16] Enter key collapses and re-expands section', () => {
    render(makeDefaultGrid());
    const benefitsRow = screen.getByText('Benefits').closest('tr');
    fireEvent.keyDown(benefitsRow!, { key: 'Enter' });
    expect(screen.queryByText('Cost savings')).toBeNull();
    fireEvent.keyDown(benefitsRow!, { key: 'Enter' });
    expect(screen.getByText('Cost savings')).toBeTruthy();
  });
});

describe('[AC17] sections expanded by default', () => {
  it('all detail rows visible on initial render', () => {
    render(makeDefaultGrid());
    expect(screen.getByText('Cost savings')).toBeTruthy();
    expect(screen.getByText('Profit increase')).toBeTruthy();
    expect(screen.getByText('Hosting')).toBeTruthy();
    expect(screen.getByText('Hardware')).toBeTruthy();
  });
});

// ─── Section grouping by category ────────────────────────────────────────────

describe('[AC12-3.7] grid groups GL accounts by category', () => {
  it('GL accounts appear under their category section', () => {
    const accounts: GridGlAccount[] = [
      makeGlAccount('gl-1', 'benefits', 'Cost savings'),
      makeGlAccount('gl-2', 'opex', 'IT Consultancy'),
      makeGlAccount('gl-3', 'capex', 'Software Licenses'),
    ];
    render(makeDefaultGrid({ glAccounts: accounts }));
    expect(screen.getByText('Cost savings')).toBeTruthy();
    expect(screen.getByText('IT Consultancy')).toBeTruthy();
    expect(screen.getByText('Software Licenses')).toBeTruthy();
  });

  it('mixed account appears in both OPEX and CAPEX sections', () => {
    const accounts: GridGlAccount[] = [
      makeGlAccount('mixed-1', 'opex',  'Hardware'),
      makeGlAccount('mixed-1', 'capex', 'Hardware'),
    ];
    render(makeDefaultGrid({ glAccounts: accounts }));
    // Both section rows should show 'Hardware' (one under OPEX, one under CAPEX)
    expect(screen.getAllByText('Hardware')).toHaveLength(2);
  });
});

// ─── Section totals (client-side, no re-fetch) ────────────────────────────────

describe('[AC14] section totals computed client-side', () => {
  it('Benefits total shows sum of detail row valueCents for each column', () => {
    const entries: GridEntry[] = [
      makeEntry('benefits-1', 4, 2026, { valueCents: 100000, category: 'benefits' }),
      makeEntry('benefits-2', 4, 2026, { valueCents: 50000,  category: 'benefits' }),
    ];
    render(makeDefaultGrid({ entries }));
    expect(screen.getByText('Benefits').closest('tr')?.textContent).toContain('1.500');
  });

  it('same GL account in OPEX and CAPEX sections totals independently', () => {
    const accounts: GridGlAccount[] = [
      makeGlAccount('mixed-1', 'opex',  'Consulting'),
      makeGlAccount('mixed-1', 'capex', 'Consulting'),
    ];
    const entries: GridEntry[] = [
      makeEntry('mixed-1', 4, 2026, { valueCents: 100000, category: 'opex'  }),
      makeEntry('mixed-1', 4, 2026, { valueCents: 200000, category: 'capex' }),
    ];
    render(makeDefaultGrid({ glAccounts: accounts, entries }));
    const opexRow  = screen.getByText('OPEX').closest('tr');
    const capexRow = screen.getByText('CAPEX').closest('tr');
    expect(opexRow?.textContent).toContain('1.000');
    expect(capexRow?.textContent).toContain('2.000');
  });
});

// ─── Grand Total row ─────────────────────────────────────────────────────────

describe('[AC15] Grand Total row', () => {
  it('Total row present at bottom of grid', () => {
    render(makeDefaultGrid());
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('Grand Total sums across all sections', () => {
    const entries: GridEntry[] = [
      makeEntry('opex-1',  4, 2026, { valueCents: 200000, category: 'opex'  }),
      makeEntry('capex-1', 4, 2026, { valueCents: 100000, category: 'capex' }),
    ];
    render(makeDefaultGrid({ entries }));
    const totalRow = screen.getByText('Total').closest('tr');
    expect(totalRow?.textContent).toContain('3.000');
  });
});

// ─── onCellChange called on blur ─────────────────────────────────────────────

describe('[AC12] detail row cell triggers onCellChange on blur', () => {
  it('calls onCellChange with (glAccountId, category, month, year, valueCents) on blur', () => {
    const onCellChange = vi.fn();
    render(makeDefaultGrid({ onCellChange }));

    const input = screen.getByLabelText(/Hosting Apr 2026/i);
    fireEvent.blur(input, { target: { value: '100' } });
    expect(onCellChange).toHaveBeenCalledWith('opex-1', 'opex', 4, 2026, 10000);
  });
});

// ─── readOnly prop ────────────────────────────────────────────────────────────

describe('[AC5-4.9] readOnly prop renders all cells as static text', () => {
  it('when readOnly={true}, no NumberInput renders', () => {
    const entries: GridEntry[] = [makeEntry('opex-1', 4, 2026, { valueCents: 50000, category: 'opex' })];
    render(makeDefaultGrid({ readOnly: true, entries }));
    expect(document.querySelectorAll('input')).toHaveLength(0);
  });

  it('when readOnly={true}, values appear as static text with 2 decimal places', () => {
    const entries: GridEntry[] = [makeEntry('opex-1', 4, 2026, { valueCents: 50000, category: 'opex' })];
    render(makeDefaultGrid({ readOnly: true, entries }));
    expect(screen.getByText('500,00')).toBeTruthy();
  });

  it('when readOnly={true}, actual cells also render as plain span (no cell-locked-actuals class)', () => {
    const entries: GridEntry[] = [makeEntry('opex-1', 4, 2026, { isActual: true, valueCents: 30000, category: 'opex' })];
    render(makeDefaultGrid({ readOnly: true, entries }));
    expect(document.querySelector('.cell-locked-actuals')).toBeNull();
    expect(document.querySelectorAll('input')).toHaveLength(0);
  });

  it('when readOnly={false} (default), editable cells render NumberInput', () => {
    render(makeDefaultGrid());
    expect(document.querySelectorAll('input').length).toBeGreaterThan(0);
  });
});

// ─── SAP-locked cells ─────────────────────────────────────────────────────────

describe('[AC18] SAP-locked cells are static text', () => {
  it('locked entry renders as span, not NumberInput', () => {
    const entries: GridEntry[] = [makeEntry('opex-1', 4, 2026, { isActual: true, valueCents: 50000, category: 'opex' })];
    render(makeDefaultGrid({ entries }));

    const lockedCell = document.querySelector('.cell-locked-actuals');
    expect(lockedCell).toBeTruthy();
    expect(lockedCell?.querySelector('input')).toBeNull();
    expect(lockedCell?.querySelector('[aria-readonly="true"]')).toBeTruthy();
  });
});

// ─── AC-5: empty-range Alert ──────────────────────────────────────────────────

describe('[AC-5] empty-range Alert when endDate < startDate', () => {
  it('renders yellow Alert instead of grid when endDate is before startDate', () => {
    render(makeDefaultGrid({ startDate: '2026-12-01', endDate: '2026-06-01' }));
    expect(screen.getByText(/end date is before the start date/i)).toBeTruthy();
    expect(screen.queryByText('OPEX')).toBeNull();
    expect(screen.queryByText('Total')).toBeNull();
  });

  it('does not render Alert for a valid date range', () => {
    render(makeDefaultGrid({ startDate: '2026-04-01', endDate: '2026-09-30' }));
    expect(screen.queryByText(/end date is before/i)).toBeNull();
    expect(screen.getByText('OPEX')).toBeTruthy();
  });
});

// ─── AC-5b: partial-date warning banner (removed) ────────────────────────────

describe('[AC-5b] no partial-date warning banner', () => {
  it('does not show partial-date banner when only startDate is set', () => {
    render(makeDefaultGrid({ startDate: '2026-04-01', endDate: null }));
    expect(screen.queryByText(/Date range is incomplete/i)).toBeNull();
    expect(screen.getByText('OPEX')).toBeTruthy();
  });

  it('does not show partial-date banner when only endDate is set', () => {
    render(makeDefaultGrid({ startDate: null, endDate: '2026-09-30' }));
    expect(screen.queryByText(/Date range is incomplete/i)).toBeNull();
    expect(screen.getByText('OPEX')).toBeTruthy();
  });

  it('does not show partial-date banner when both dates are set', () => {
    render(makeDefaultGrid({ startDate: '2026-04-01', endDate: '2026-09-30' }));
    expect(screen.queryByText(/Date range is incomplete/i)).toBeNull();
  });

  it('does not show partial-date banner when both dates are null', () => {
    render(makeDefaultGrid({ startDate: null, endDate: null }));
    expect(screen.queryByText(/Date range is incomplete/i)).toBeNull();
  });
});
