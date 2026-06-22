export type CellState = 'editable' | 'locked-actuals' | 'user-set';

export interface FinancialColumn {
  key:   string;
  label: string;
  state: CellState;
}

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
