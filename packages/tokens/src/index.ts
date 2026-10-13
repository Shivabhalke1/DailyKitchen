/**
 * Canonical Design Tokens for DailyKitchen
 *
 * Strict Design System Constraints:
 * - Green-led visual identity (fresh groceries)
 * - Prohibited: Purple gradients, random gradients, pill-shaped buttons, emoji icons in UI
 * - WCAG 2.2 Level AA accessible contrast minimums
 */

export const colors = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d', // Primary brand green
    800: '#166534',
    900: '#14532d',
  },
  accent: {
    50: '#ecfdf5',
    100: '#d1fae5',
    500: '#10b981',
    600: '#059669',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  neutral: {
    white: '#ffffff',
    background: '#f8fafc', // Clean off-white app background
    surface: '#ffffff',    // Card / surface background
    surfaceMuted: '#f1f5f9',
    border: '#e2e8f0',     // Subtle accessible borders
    borderFocus: '#15803d',
    text: '#0f172a',       // Slate-900 primary high contrast text
    textMuted: '#64748b',  // Slate-500 secondary text
    textSubtle: '#94a3b8',
  },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 8,  // Standard interactive components (buttons, inputs)
  lg: 12, // Cards & modals
  xl: 16, // Prominent surfaces
  // Note: Pill radius is strictly prohibited by DailyKitchen Design System rules
} as const;

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const touchTargets = {
  minWidth: 44,
  minHeight: 44, // WCAG 2.2 AA touch target compliance
} as const;

export const tokens = {
  colors,
  spacing,
  radii,
  typography,
  touchTargets,
} as const;

export type Tokens = typeof tokens;
