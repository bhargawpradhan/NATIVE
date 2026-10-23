import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Radii, Spacing } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'subtle' | 'accent' | 'warning';
  onPress?: () => void;
}

export function Card({ children, style, variant = 'default', onPress }: CardProps) {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'subtle':
        return styles.variantSubtle;
      case 'accent':
        return styles.variantAccent;
      case 'warning':
        return styles.variantWarning;
      case 'default':
      default:
        return styles.variantDefault;
    }
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.base,
          getVariantStyle(),
          pressed && styles.pressed,
          style
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.base, getVariantStyle(), style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    padding: Spacing.cardPadding,
    overflow: 'hidden'
  },
  variantDefault: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border
  },
  variantSubtle: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderSubtle
  },
  variantAccent: {
    backgroundColor: '#0F172A', // Premium slate/dark hero card
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  variantWarning: {
    backgroundColor: Colors.statusOverdue.background,
    borderWidth: 1,
    borderColor: Colors.statusOverdue.border
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }]
  }
});
