import { Select } from '@mantine/core';

export interface PresetConfig {
  value: string;
  label: string;
}

interface Props {
  presets: PresetConfig[];
  defaultValue: string;
  onChange: (value: string) => void;
  /** Accessible label for the dropdown (not visually rendered). Defaults to "Filter". */
  label?: string;
  /** Control width in px. Defaults to 180. */
  width?: number;
}

/**
 * Canonical single-select filter control for list/table views.
 * Renders a neutral `Select` dropdown (design-system §5 — single-select filters
 * use `Select`, never `SegmentedControl`/`Chip`). Sits inline with other filters
 * in a search-first row: [search…][selector][next filter][…].
 */
export function FilterPresetBar({ presets, defaultValue, onChange, label = 'Filter', width = 180 }: Props) {
  return (
    <Select
      aria-label={label}
      data={presets.map((p) => ({ label: p.label, value: p.value }))}
      value={defaultValue}
      onChange={(value) => { if (value !== null) onChange(value); }}
      size="sm"
      w={width}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
