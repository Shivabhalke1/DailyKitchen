import { colors, spacing, radii, typography, touchTargets } from '@dailykitchen/tokens';

export const theme = {
  colors: {
    ...colors,
    primary: {
      ...colors.primary,
      main: colors.primary[700],
      light: colors.primary[50],
    },
    accent: {
      ...colors.accent,
      main: colors.accent[600],
      light: colors.accent[50],
    },
    success: {
      50: colors.accent[50],
      100: colors.accent[100],
      500: colors.accent[500],
      600: colors.accent[600],
      main: colors.accent[600],
      light: colors.accent[50],
    },
    neutral: {
      ...colors.neutral,
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    error: {
      ...colors.error,
      main: colors.error[600],
      border: colors.error[100],
      light: colors.error[50],
    },
    warning: {
      ...colors.warning,
      main: colors.warning[600],
      border: colors.warning[100],
      light: colors.warning[50],
    },
  },
  spacing: {
    ...spacing,
    0.5: 2,
    1.5: 6,
    2.5: 10,
    3.5: 14,
  },
  radii: {
    ...radii,
    full: 9999,
  },
  borderRadius: {
    ...radii,
    full: 9999,
  },
  typography,
  touchTargets,
} as const;

export type Theme = typeof theme;
