import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../../theme';

export interface BadgeProps {
  children: string;
  variant?: 'fresh' | 'success' | 'warning' | 'discount' | 'neutral';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'fresh',
  style,
}) => {
  const getColors = (): { bg: string; text: string; border: string } => {
    switch (variant) {
      case 'fresh':
        return {
          bg: theme.colors.primary[50],
          text: theme.colors.primary[800],
          border: theme.colors.primary[200],
        };
      case 'success':
        return {
          bg: theme.colors.accent[50],
          text: theme.colors.accent[600],
          border: theme.colors.accent[100],
        };
      case 'warning':
        return {
          bg: theme.colors.warning[50],
          text: theme.colors.warning[700],
          border: theme.colors.warning[100],
        };
      case 'discount':
        return {
          bg: theme.colors.warning[50],
          text: theme.colors.warning[600],
          border: theme.colors.warning[100],
        };
      case 'neutral':
        return {
          bg: theme.colors.neutral.surfaceMuted,
          text: theme.colors.neutral.textMuted,
          border: theme.colors.neutral.border,
        };
    }
  };

  const { bg, text, border } = getColors();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border },
        style,
      ]}
    >
      <Text style={[styles.text, { color: text }]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.radii.sm, // Rectangular with rounded corners (strictly NO pill shape)
    borderWidth: 1,
  },
  text: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
});
