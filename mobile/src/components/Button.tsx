import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle
} from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let base: ViewStyle = { ...styles.base, ...styles[`size_${size}`] };

    switch (variant) {
      case 'primary':
        base = {
          ...base,
          backgroundColor: pressed ? Colors.brandPrimaryPressed : Colors.brandPrimary
        };
        break;
      case 'secondary':
        base = {
          ...base,
          backgroundColor: pressed ? Colors.surfaceMuted : Colors.surfaceSubtle
        };
        break;
      case 'outline':
        base = {
          ...base,
          backgroundColor: pressed ? Colors.surfaceSubtle : 'transparent',
          borderWidth: 1,
          borderColor: Colors.border
        };
        break;
      case 'danger':
        base = {
          ...base,
          backgroundColor: pressed ? '#B91C1C' : Colors.statusOverdue.text
        };
        break;
      case 'ghost':
        base = {
          ...base,
          backgroundColor: pressed ? Colors.surfaceSubtle : 'transparent'
        };
        break;
    }

    if (isDisabled) {
      base = {
        ...base,
        opacity: 0.55
      };
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    let base: TextStyle = { ...styles.textBase, ...styles[`textSize_${size}`] };

    switch (variant) {
      case 'primary':
      case 'danger':
        base = { ...base, color: Colors.textInverse };
        break;
      case 'secondary':
      case 'outline':
      case 'ghost':
        base = { ...base, color: Colors.textPrimary };
        break;
    }

    return base;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [getContainerStyle(pressed), style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? Colors.textInverse : Colors.textPrimary}
        />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
    gap: Spacing.sm
  },
  textBase: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    textAlign: 'center'
  },
  size_sm: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md
  },
  size_md: {
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg
  },
  size_lg: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl
  },
  textSize_sm: {
    ...Typography.bodySmall,
    fontWeight: '600'
  },
  textSize_md: {
    ...Typography.body,
    fontWeight: '600'
  },
  textSize_lg: {
    ...Typography.bodyLarge,
    fontWeight: '700'
  }
});
