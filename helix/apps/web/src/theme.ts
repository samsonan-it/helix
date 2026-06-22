import {createTheme, type MantineColorsTuple} from '@mantine/core';

// STADA Red — primary brand. #CC0033 at index [6] (see design-system.md §1 "Why both brand hexes live at index 6").
const stadaRed: MantineColorsTuple = [
    '#fff0f3', '#ffdde4', '#ffb3c1', '#ff809a', '#ff4d73',
    '#e6003b', '#CC0033', '#a80029', '#8a0022', '#6e001b', // [6] = brand primary
];

// STADA Blue — secondary / informational. #0065BD at index [6].
const stadaBlue: MantineColorsTuple = [
    '#e6f0fb', '#cce0f6', '#99c1ed', '#66a2e3', '#3383da',
    '#0a75d1', '#0065BD', '#0054a0', '#004383', '#003467', // [6] = brand secondary
];

// Functional green — success. Only [6] (#2d8a4e) is brand-sanctioned; the rest is a
// functional ramp so Mantine variants render. Not a STADA brand colour. (design-system.md §6)
const green: MantineColorsTuple = [
    '#eaf7ef', '#d3edda', '#a9dab9', '#7cc695', '#57b576',
    '#3ba85f', '#2d8a4e', '#26743f', '#1e5d33', '#154425', // [6] = sanctioned success hex
];

// Functional amber — overdue / stalled. Only [6] (#f5a623) is sanctioned. Not a brand colour.
const orange: MantineColorsTuple = [
    '#fff7e8', '#ffeccb', '#ffd896', '#ffc35e', '#f9b13a',
    '#f6a82c', '#f5a623', '#d98a12', '#b06d0c', '#8a5408', // [6] = sanctioned amber hex
];

export const theme = createTheme({
    primaryColor: 'stadaRed',
    primaryShade: 6, // single global shade — keeps stadaRed AND stadaBlue at their brand hex (§1)
    colors: {stadaRed, stadaBlue, green, orange},

    fontFamily: '"Frutiger", "Frutiger LT", "Myriad Pro", Arial, Helvetica, sans-serif',
    fontFamilyMonospace: '"Fira Code", "Courier New", monospace',
    headings: {
        fontFamily: '"Frutiger", "Frutiger LT", "Myriad Pro", Arial, Helvetica, sans-serif',
        fontWeight: '700',
        sizes: {
            h1: {fontSize: '2rem', lineHeight: '1.15'},
            h2: {fontSize: '1.5rem', lineHeight: '1.2'},
            h3: {fontSize: '1.125rem', lineHeight: '1.3'},
            h4: {fontSize: '1rem', lineHeight: '1.4'},
        },
    },
    fontSizes: {
        xs: '0.75rem',   // 12px — captions, footnotes
        sm: '0.875rem',  // 14px — supporting text
        md: '1rem',      // 16px — body (base)
        lg: '1.125rem',  // 18px — component headings
        xl: '1.25rem',   // 20px — section subheadings
    },
    defaultRadius: 'sm',
    radius: {xs: '2px', sm: '4px', md: '8px', lg: '16px', xl: '999px'},
    spacing: {xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px'},
    other: {
        appBackground: '#F9FAFB', // light shell content canvas
        surface: '#FFFFFF',
        mutedText: '#666666',
        disabledText: '#A7A9AC',
    },
    components: {
        AppShell: {defaultProps: {padding: 0}},   // pages own their padding (IC-1)
        Button: {defaultProps: {radius: 'xl'}},  // pill
        ActionIcon: {defaultProps: {radius: 'xl'}},  // pill
        Badge: {defaultProps: {radius: 'xl'}},  // pill
    },
});
