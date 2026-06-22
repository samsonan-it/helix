import React, { useReducer, useCallback, useEffect, useMemo, useState } from 'react';
import { Table, NumberInput, Box, Group, Tooltip, ActionIcon, Alert } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconChevronsDown, IconChevronsUp } from '@tabler/icons-react';
import { MONTH_LABELS } from './columns';
import './GridTheme.css';

export interface MonthColumn {
  year: number;
  month: number;
}

export interface GridGlAccount {
  id: string;
  category: 'benefits' | 'opex' | 'capex';
  label: string;
  isActive: boolean;
}

export interface GridEntry {
  glAccountId: string;
  category: 'benefits' | 'opex' | 'capex';
  month: number;
  year: number;
  valueCents: number;
  isActual: boolean;
  isUserSet: boolean;
}

export interface FinancialGridProps {
  glAccounts: GridGlAccount[];
  entries: GridEntry[];
  onCellChange?: (glAccountId: string, category: 'benefits' | 'opex' | 'capex', month: number, year: number, valueCents: number) => void;
  startDate?: string | null;
  endDate?: string | null;
  readOnly?: boolean;
  sections?: Array<'benefits' | 'opex' | 'capex'>;
}

type RenderedColumn =
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number };

export function deriveVisibleColumns(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: Date = new Date(),
): MonthColumn[] {
  if (startDate === undefined && endDate === undefined) {
    const y = today.getFullYear();
    return Array.from({ length: 12 }, (_, i) => ({ year: y, month: i + 1 }));
  }
  const start = startDate ? new Date(startDate) : today;
  const endFallback = new Date(start.getFullYear(), 11, 31);
  const end = endDate ? new Date(endDate) : endFallback;
  const cols: MonthColumn[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= limit) {
    cols.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return cols;
}

function groupByYear(cols: MonthColumn[]): { year: number; count: number }[] {
  const groups: { year: number; count: number }[] = [];
  for (const col of cols) {
    if (groups.length === 0 || groups[groups.length - 1].year !== col.year) {
      groups.push({ year: col.year, count: 1 });
    } else {
      groups[groups.length - 1].count++;
    }
  }
  return groups;
}

function entryKey(glAccountId: string, category: string, year: number, month: number) {
  return `${glAccountId}:${category}:${year}:${month}`;
}

type GridAction =
  | { type: 'SET_CELL'; glAccountId: string; category: 'benefits' | 'opex' | 'capex'; month: number; year: number; valueCents: number }
  | { type: 'SYNC'; entries: GridEntry[] };

function gridReducer(state: Map<string, GridEntry>, action: GridAction): Map<string, GridEntry> {
  switch (action.type) {
    case 'SET_CELL': {
      const key = entryKey(action.glAccountId, action.category, action.year, action.month);
      const existing = state.get(key);
      const next = new Map(state);
      next.set(key, {
        glAccountId: action.glAccountId,
        category: action.category,
        month: action.month,
        year: action.year,
        valueCents: action.valueCents,
        isActual: existing?.isActual ?? false,
        isUserSet: existing?.valueCents !== action.valueCents ? true : (existing?.isUserSet ?? false),
      });
      return next;
    }
    case 'SYNC': {
      const next = new Map(state);
      for (const incoming of action.entries) {
        const key = entryKey(incoming.glAccountId, incoming.category, incoming.year, incoming.month);
        const local = state.get(key);
        if (local && local.isUserSet && local.valueCents !== incoming.valueCents) continue;
        next.set(key, incoming);
      }
      return next;
    }
    default:
      return state;
  }
}

const SECTION_LABELS: Record<string, string> = { benefits: 'Benefits', opex: 'OPEX', capex: 'CAPEX' };
const SECTIONS: Array<'benefits' | 'opex' | 'capex'> = ['benefits', 'opex', 'capex'];

export function FinancialGrid({
  glAccounts,
  entries,
  onCellChange,
  startDate,
  endDate,
  readOnly = false,
  sections = SECTIONS,
}: FinancialGridProps): React.ReactElement {
  const effectiveReadOnly = readOnly || !onCellChange;
  const initialState = useMemo(() => {
    const map = new Map<string, GridEntry>();
    for (const e of entries) {
      map.set(entryKey(e.glAccountId, e.category, e.year, e.month), e);
    }
    return map;
  }, []);

  const [gridState, dispatch] = useReducer(gridReducer, initialState);

  useEffect(() => {
    dispatch({ type: 'SYNC', entries });
  }, [entries]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    benefits: false,
    opex: false,
    capex: false,
  });

  const allCollapsed = sections.every((s) => collapsed[s]);

  const toggleAllSections = useCallback(() => {
    const next = !allCollapsed;
    setCollapsed((prev) => ({ ...prev, ...Object.fromEntries(sections.map((s) => [s, next])) }));
  }, [allCollapsed, sections]);

  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

  const toggleYear = useCallback((year: number) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }, []);

  const visibleColumns = useMemo(() => deriveVisibleColumns(startDate, endDate), [startDate, endDate]);

  const yearGroups = useMemo(() => groupByYear(visibleColumns), [visibleColumns]);

  const renderedColumns = useMemo((): RenderedColumn[] => {
    const cols: RenderedColumn[] = [];
    for (const { year } of yearGroups) {
      cols.push({ kind: 'year', year });
      if (!collapsedYears.has(year)) {
        for (const mc of visibleColumns.filter((c) => c.year === year)) {
          cols.push({ kind: 'month', year: mc.year, month: mc.month });
        }
      }
    }
    return cols;
  }, [visibleColumns, yearGroups, collapsedYears]);

  // section totals use entry.category directly — no glAccounts lookup needed
  const sectionTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = { benefits: {}, opex: {}, capex: {} };
    for (const [, entry] of gridState) {
      const colKey = `${entry.year}:${entry.month}`;
      if (totals[entry.category]) {
        totals[entry.category][colKey] = (totals[entry.category][colKey] ?? 0) + entry.valueCents;
      }
    }
    return totals;
  }, [gridState]);

  const grandTotals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const section of Object.values(sectionTotals)) {
      for (const [colKey, val] of Object.entries(section)) {
        result[colKey] = (result[colKey] ?? 0) + val;
      }
    }
    return result;
  }, [sectionTotals]);

  const sectionYearTotals = useMemo(() => {
    const result: Record<string, Record<number, number>> = { benefits: {}, opex: {}, capex: {} };
    for (const { year } of yearGroups) {
      for (const section of SECTIONS) {
        result[section][year] = visibleColumns
          .filter((c) => c.year === year)
          .reduce((sum, c) => sum + (sectionTotals[section][`${c.year}:${c.month}`] ?? 0), 0);
      }
    }
    return result;
  }, [sectionTotals, visibleColumns, yearGroups]);

  const grandYearTotals = useMemo(() => {
    const result: Record<number, number> = {};
    for (const { year } of yearGroups) {
      result[year] = visibleColumns
        .filter((c) => c.year === year)
        .reduce((sum, c) => sum + (grandTotals[`${c.year}:${c.month}`] ?? 0), 0);
    }
    return result;
  }, [grandTotals, visibleColumns, yearGroups]);

  const getAccountYearSum = (accountId: string, category: string, year: number): number =>
    visibleColumns
      .filter((c) => c.year === year)
      .reduce((sum, c) => sum + (gridState.get(entryKey(accountId, category, c.year, c.month))?.valueCents ?? 0), 0);

  const handleCellChange = useCallback(
    (glAccountId: string, category: 'benefits' | 'opex' | 'capex', month: number, year: number, valueCents: number) => {
      dispatch({ type: 'SET_CELL', glAccountId, category, month, year, valueCents });
      onCellChange?.(glAccountId, category, month, year, valueCents);
    },
    [onCellChange],
  );

  // AC-5: early return after all hooks — invalid range when both dates are set but end < start
  if (visibleColumns.length === 0 && startDate != null && endDate != null) {
    return (
      <Alert color="yellow">
        The end date is before the start date — adjust the dates above to see the planning grid.
      </Alert>
    );
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table withTableBorder fz="xs" verticalSpacing={1} horizontalSpacing={6} style={{ tableLayout: 'fixed', width: 'max-content' }}>
        <Table.Thead className="grid-thead">
          <Table.Tr>
            <Table.Th className="col-category-header" style={{ width: 220 }}>
              <Group gap={4} justify="flex-end">
                <Tooltip label={allCollapsed ? 'Expand all' : 'Collapse all'} withArrow>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    color="gray"
                    aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                    onClick={toggleAllSections}
                  >
                    {allCollapsed ? <IconChevronsDown size={12} /> : <IconChevronsUp size={12} />}
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Table.Th>
            {renderedColumns.map((col) =>
              col.kind === 'year' ? (
                <Table.Th
                  key={`year-${col.year}`}
                  onClick={() => toggleYear(col.year)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleYear(col.year);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={!collapsedYears.has(col.year)}
                  aria-label={`${col.year}, ${collapsedYears.has(col.year) ? 'collapsed' : 'expanded'}, click to toggle`}
                  className="col-year-header"
                  style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: 96 }}
                >
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    {collapsedYears.has(col.year) ? (
                      <IconChevronRight size={14} />
                    ) : (
                      <IconChevronDown size={14} />
                    )}
                    {col.year}
                  </Group>
                </Table.Th>
              ) : (
                <Table.Th
                  key={`${col.year}-${col.month}`}
                  style={{ textAlign: 'right', width: 96 }}
                >
                  {MONTH_LABELS[col.month - 1]}
                </Table.Th>
              ),
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sections.map((section) => {
            const isCollapsed = collapsed[section];
            const sectionItems = glAccounts
              .filter((t) => t.category === section)
              .sort((a, b) => a.label.localeCompare(b.label));

            return (
              <React.Fragment key={section}>
                <Table.Tr
                  onClick={() => setCollapsed((c) => ({ ...c, [section]: !c[section] }))}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setCollapsed((c) => ({ ...c, [section]: !c[section] }));
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={!isCollapsed}
                  style={{ cursor: 'pointer', fontWeight: 700, background: '#f8f9fa', userSelect: 'none' }}
                >
                  <Table.Th scope="row" className="col-category-section">
                    <Group gap={4}>
                      {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                      {SECTION_LABELS[section]}
                    </Group>
                  </Table.Th>
                  {renderedColumns.map((col) => {
                    if (col.kind === 'year') {
                      const total = sectionYearTotals[section][col.year] ?? 0;
                      return (
                        <Table.Td
                          key={`year-${col.year}`}
                          className="col-year-sum"
                          style={{ textAlign: 'right', fontWeight: 700 }}
                        >
                          {Math.round(total / 100).toLocaleString('de-DE')}
                        </Table.Td>
                      );
                    }
                    const colKey = `${col.year}:${col.month}`;
                    const total = sectionTotals[section][colKey] ?? 0;
                    return (
                      <Table.Td key={colKey} style={{ textAlign: 'right', fontWeight: 700 }}>
                        {Math.round(total / 100).toLocaleString('de-DE')}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>

                {!isCollapsed &&
                  sectionItems.map((item) => (
                    <Table.Tr key={`${item.id}:${item.category}`}>
                      <Table.Td className="col-category" style={{ paddingLeft: 20 }}>
                        <Tooltip label={item.label} withArrow openDelay={400} disabled={item.label.length <= 28}>
                          <span className="col-category-label">{item.label}</span>
                        </Tooltip>
                      </Table.Td>
                      {renderedColumns.map((col) => {
                        if (col.kind === 'year') {
                          const yearSum = getAccountYearSum(item.id, item.category, col.year);
                          return (
                            <Table.Td
                              key={`year-${col.year}`}
                              className="col-year-sum"
                              style={{ padding: '2px 4px', textAlign: 'right' }}
                            >
                              <span aria-readonly="true">{Math.round(yearSum / 100).toLocaleString('de-DE')}</span>
                            </Table.Td>
                          );
                        }
                        const key = entryKey(item.id, item.category, col.year, col.month);
                        const entry = gridState.get(key);
                        const valueCents = entry?.valueCents ?? 0;
                        const isActual = entry?.isActual ?? false;
                        const isUserSet = entry?.isUserSet ?? false;
                        const cellClass = effectiveReadOnly
                          ? undefined
                          : isActual
                          ? 'cell-locked-actuals'
                          : isUserSet
                          ? 'cell-user-set'
                          : 'cell-editable';
                        return (
                          <Table.Td
                            key={`${col.year}-${col.month}`}
                            className={cellClass}
                            style={{ padding: '2px 4px', textAlign: 'right' }}
                          >
                            {effectiveReadOnly ? (
                              <span>{(valueCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            ) : isActual ? (
                              <span aria-readonly="true">{Math.round(valueCents / 100).toLocaleString('de-DE')}</span>
                            ) : (
                              <NumberInput
                                key={valueCents}
                                defaultValue={valueCents / 100}
                                min={0}
                                aria-label={`${item.label} ${MONTH_LABELS[col.month - 1]} ${col.year}`}
                                variant="unstyled"
                                hideControls
                                styles={{
                                  wrapper: { minHeight: 'unset' },
                                  input: { textAlign: 'right', padding: 0, height: 'auto', minHeight: 'unset', lineHeight: 1.4, fontSize: 'var(--mantine-font-size-xs)' },
                                }}
                                onBlur={(e) => {
                                  const euros = parseFloat(e.currentTarget.value) || 0;
                                  handleCellChange(item.id, item.category, col.month, col.year, Math.round(euros * 100));
                                }}
                              />
                            )}
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  ))}
              </React.Fragment>
            );
          })}

          <Table.Tr style={{ fontWeight: 700, borderTop: '2px solid #dee2e6' }}>
            <Table.Th scope="row" className="col-category">Total</Table.Th>
            {renderedColumns.map((col) => {
              if (col.kind === 'year') {
                return (
                  <Table.Td
                    key={`year-${col.year}`}
                    className="col-year-sum"
                    style={{ textAlign: 'right', fontWeight: 700 }}
                  >
                    {Math.round((grandYearTotals[col.year] ?? 0) / 100).toLocaleString('de-DE')}
                  </Table.Td>
                );
              }
              const colKey = `${col.year}:${col.month}`;
              return (
                <Table.Td key={colKey} style={{ textAlign: 'right', fontWeight: 700 }}>
                  {Math.round((grandTotals[colKey] ?? 0) / 100).toLocaleString('de-DE')}
                </Table.Td>
              );
            })}
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Box>
  );
}
