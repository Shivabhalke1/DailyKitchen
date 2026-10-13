import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import { theme } from '../../theme';

export interface ButtonProps extends PressableProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let bgStyle: ViewStyle = {};
    let borderStyle: ViewStyle = {};

    switch (variant) {
      case 'primary':
        bgStyle = { backgroundColor: pressed ? theme.colors.primary[800] : theme.colors.primary[700] };
        break;
      case 'secondary':
        bgStyle = { backgroundColor: pressed ? theme.colors.accent[100] : theme.colors.accent[50] };
        borderStyle = { borderWidth: 1, borderColor: theme.colors.primary[200] };
        break;
      case 'outline':
        bgStyle = { backgroundColor: pressed ? theme.colors.neutral.surfaceMuted : theme.colors.neutral.surface };
        borderStyle = { borderWidth: 1, borderColor: theme.colors.neutral.border };
        break;
      case 'ghost':
        bgStyle = { backgroundColor: pressed ? theme.colors.neutral.surfaceMuted : 'transparent' };
        break;
    }

    let sizePadding: ViewStyle = {};
    switch (size) {
      case 'sm':
        sizePadding = { paddingVertical: 8, paddingHorizontal: 12 };
        break;
      case 'md':
        sizePadding = { paddingVertical: 12, paddingHorizontal: 16 };
        break;
      case 'lg':
        sizePadding = { paddingVertical: 16, paddingHorizontal: 24 };
        break;
    }

    return {
      ...styles.base,
      ...bgStyle,
      ...borderStyle,
      ...sizePadding,
      ...(fullWidth ? styles.fullWidth : {}),
      ...(isDisabled ? styles.disabled : {}),
      ...style,
    };
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
        return { color: theme.colors.neutral.white };
      case 'secondary':
        return { color: theme.colors.primary[800] };
      case 'outline':
      case 'ghost':
        return { color: theme.colors.neutral.text };
    }
  };

  return (
    <Pressable
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      style={({ pressed }) => getContainerStyle(pressed)}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? theme.colors.neutral.white : theme.colors.primary[700]}
        />
      ) : typeof children === 'string' ? (
        <Text style={[styles.text, getTextStyle()]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: theme.touchTargets.minHeight,
    minWidth: theme.touchTargets.minWidth,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    textAlign: 'center',
  },
});
