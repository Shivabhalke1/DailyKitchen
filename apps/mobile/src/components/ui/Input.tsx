import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { theme } from '../../theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  editable = true,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          error ? styles.inputError : styles.inputNormal,
          !editable && styles.inputDisabled,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          editable={editable}
          placeholderTextColor={theme.colors.neutral.textMuted}
          style={[styles.input, style]}
          accessibilityLabel={label}
          {...props}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {!error && helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
    color: theme.colors.neutral.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.touchTargets.minHeight,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.neutral.white,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inputNormal: {
    borderColor: theme.colors.neutral.border,
  },
  inputError: {
    borderColor: theme.colors.error[500],
  },
  inputDisabled: {
    backgroundColor: theme.colors.neutral.surfaceMuted,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.neutral.text,
    paddingVertical: 10,
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error[600],
    marginTop: 4,
  },
  helperText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral.textMuted,
    marginTop: 4,
  },
});
