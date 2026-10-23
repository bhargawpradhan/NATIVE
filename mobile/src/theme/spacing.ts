/**
 * MiniLedger Design System - Spacing Scale
 * Predictable 4px / 8px incremental system.
 */

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,

  // Semantic layout shortcuts
  screenPadding: 16,
  cardPadding: 16,
  inputPadding: 14,
  buttonPadding: 14,
  rowGap: 12
} as const;

export type SpacingToken = keyof typeof Spacing;
