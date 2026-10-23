import { TextStyle } from 'react-native';

/**
 * MiniLedger Design System - Typography Scale
 * Uses tabular numbers for financial amounts to avoid visual jitter.
 */

export const Typography: Record<string, TextStyle> = {
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5
  },
  h2: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.3
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: -0.2
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0.2
  },
  currencyHero: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    fontVariant: ['tabular-nums']
  },
  currencyCard: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    fontVariant: ['tabular-nums']
  },
  currencyRow: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    fontVariant: ['tabular-nums']
  }
} as const;

export type TypographyToken = keyof typeof Typography;
