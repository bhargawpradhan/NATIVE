import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle
} from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  error?: boolean;
  style?: ViewStyle;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  style
}: OtpInputProps) {
  const inputRef = useRef<any>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (value.length === length) {
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  const handlePress = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  const digits = value.split('');

  return (
    <Pressable onPress={handlePress} style={[styles.container, style]}>
      {/* Hidden real TextInput */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          const cleaned = text.replace(/[^0-9]/g, '').slice(0, length);
          onChange(cleaned);
        }}
        keyboardType="number-pad"
        maxLength={length}
        textContentType="oneTimeCode"
        autoFocus
        editable={!disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.hiddenInput}
        aria-label="One-time password input"
      />

      {/* Render 6 visible digit boxes */}
      <View style={styles.cellsRow}>
        {Array.from({ length }).map((_, index) => {
          const char = digits[index] || '';
          const isCurrentActive = isFocused && (index === digits.length || (index === length - 1 && digits.length === length));

          return (
            <View
              key={index}
              style={[
                styles.cell,
                char ? styles.cellFilled : null,
                isCurrentActive ? styles.cellActive : null,
                error ? styles.cellError : null,
                disabled ? styles.cellDisabled : null
              ]}
            >
              <Text style={[styles.cellText, error && styles.cellTextError]}>
                {char}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0
  },
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm
  },
  cell: {
    width: 46,
    height: 56,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cellFilled: {
    borderColor: Colors.textPrimary,
    backgroundColor: '#FFFFFF'
  },
  cellActive: {
    borderColor: Colors.brandAccent,
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.04 }]
  },
  cellError: {
    borderColor: Colors.statusOverdue.text,
    backgroundColor: Colors.statusOverdue.background
  },
  cellDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.surfaceSubtle
  },
  cellText: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontVariant: ['tabular-nums']
  },
  cellTextError: {
    color: Colors.statusOverdue.text
  }
});
