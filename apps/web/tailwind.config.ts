import type { Config } from 'tailwindcss';
import { colors, radii } from '@dailykitchen/tokens';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: colors.primary,
        accent: colors.accent,
        warning: colors.warning,
        error: colors.error,
        surface: colors.neutral.surface,
        appBg: colors.neutral.background,
        textPrimary: colors.neutral.text,
        textMuted: colors.neutral.textMuted,
        borderSubtle: colors.neutral.border,
      },
      borderRadius: {
        sm: `${radii.sm}px`,
        md: `${radii.md}px`,
        lg: `${radii.lg}px`,
        xl: `${radii.xl}px`,
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};

export default config;
