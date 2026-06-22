import { describe, it, expect } from 'vitest';
import { theme } from './theme';

// Guards the canonical design-system §9 token contract. See Outputs/1-planning/design-system.md.
describe('theme (design-system §9)', () => {
  it('keeps brand colours and a single global primaryShade 6 (AC-1)', () => {
    expect(theme.primaryColor).toBe('stadaRed');
    expect(theme.primaryShade).toBe(6);
    expect(theme.colors?.stadaRed?.[6]).toBe('#CC0033');
    expect(theme.colors?.stadaBlue?.[6]).toBe('#0065BD');
  });

  it('registers green/orange status tuples with the sanctioned hex at index 6 (AC-2)', () => {
    expect(theme.colors?.green?.[6]).toBe('#2d8a4e');
    expect(theme.colors?.orange?.[6]).toBe('#f5a623');
  });

  it('defines the full typography scale and monospace family (AC-3)', () => {
    expect(theme.fontFamily).toBe(
      '"Frutiger", "Frutiger LT", "Myriad Pro", Arial, Helvetica, sans-serif',
    );
    expect(theme.fontFamilyMonospace).toBe('"Fira Code", "Courier New", monospace');
    expect(theme.headings?.fontWeight).toBe('700');
    expect(theme.headings?.sizes?.h1?.fontSize).toBe('2rem');
    expect(theme.headings?.sizes?.h2?.fontSize).toBe('1.5rem');
    expect(theme.headings?.sizes?.h3?.fontSize).toBe('1.125rem');
    expect(theme.headings?.sizes?.h4?.fontSize).toBe('1rem');
    expect(theme.fontSizes).toMatchObject({
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
    });
  });

  it('defines the radius scale with the pill at xl and defaultRadius sm (AC-4)', () => {
    expect(theme.defaultRadius).toBe('sm');
    expect(theme.radius).toMatchObject({
      xs: '2px',
      sm: '4px',
      md: '8px',
      lg: '16px',
      xl: '999px',
    });
  });

  it('defines the 4px-based spacing scale incl. xxl (AC-5)', () => {
    expect(theme.spacing).toMatchObject({
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      xxl: '48px',
    });
  });

  it('replaces the stray other block with the semantic tokens (AC-6)', () => {
    expect(theme.other).toEqual({
      appBackground: '#F9FAFB',
      surface: '#FFFFFF',
      mutedText: '#666666',
      disabledText: '#A7A9AC',
    });
  });

  it('keeps pill component defaults and AppShell padding 0', () => {
    expect(theme.components?.AppShell?.defaultProps).toMatchObject({ padding: 0 });
    expect(theme.components?.Button?.defaultProps).toMatchObject({ radius: 'xl' });
    expect(theme.components?.ActionIcon?.defaultProps).toMatchObject({ radius: 'xl' });
    expect(theme.components?.Badge?.defaultProps).toMatchObject({ radius: 'xl' });
  });
});
