import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle
} from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  prefix?: string;
  error?: string | null;
  helperText?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export function Input({
  label,
  prefix,
  error,
  helperText,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null
        ]}
      >
        {prefix ? (
          <View style={styles.prefixContainer}>
            <Text style={styles.prefixText}>{prefix}</Text>
          </View>
        ) : null}

        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={Colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600'
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    minHeight: 48,
    overflow: 'hidden'
  },
  inputWrapperFocused: {
    borderColor: Colors.borderFocus,
    backgroundColor: '#FFFFFF'
  },
  inputWrapperError: {
    borderColor: Colors.statusOverdue.text,
    backgroundColor: Colors.statusOverdue.background
  },
  prefixContainer: {
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    justifyContent: 'center'
  },
  prefixText: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontWeight: '700'
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    ...Typography.bodyLarge,
    color: Colors.textPrimary
  },
  errorText: {
    ...Typography.caption,
    color: Colors.statusOverdue.text,
    fontWeight: '500'
  },
  helperText: {
    ...Typography.caption,
    color: Colors.textMuted
  }
});
