import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';
import { LoanStatus } from '../types';

interface BadgeProps {
  status: LoanStatus;
}

export function Badge({ status }: BadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'OVERDUE':
        return {
          bg: Colors.statusOverdue.background,
          border: Colors.statusOverdue.border,
          text: Colors.statusOverdue.text,
          label: 'OVERDUE'
        };
      case 'REPAID':
        return {
          bg: Colors.statusRepaid.background,
          border: Colors.statusRepaid.border,
          text: Colors.statusRepaid.text,
          label: 'REPAID'
        };
      case 'ACTIVE':
      default:
        return {
          bg: Colors.statusActive.background,
          border: Colors.statusActive.border,
          text: Colors.statusActive.text,
          label: 'ACTIVE'
        };
    }
  };

  const current = getStatusStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: current.bg,
          borderColor: current.border
        }
      ]}
    >
      <Text style={[styles.text, { color: current.text }]}>{current.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  text: {
    ...Typography.caption,
    fontWeight: '700'
  }
});
