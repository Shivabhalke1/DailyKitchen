import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import { theme } from '../../theme';

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  bordered = true,
  style,
  ...props
}) => {
  const getPaddingStyle = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'sm':
        return { padding: theme.spacing[3] };
      case 'md':
        return { padding: theme.spacing[4] };
      case 'lg':
        return { padding: theme.spacing[6] };
    }
  };

  return (
    <View
      style={[
        styles.card,
        bordered && styles.bordered,
        getPaddingStyle(),
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.neutral.surface,
    borderRadius: theme.radii.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bordered: {
    borderWidth: 1,
    borderColor: theme.colors.neutral.border,
  },
});
