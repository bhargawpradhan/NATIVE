/**
 * MiniLedger Design System - Radii & Elevation Tokens
 */

export const Radii = {
  none: 0,
  sm: 6, // Status pills, small tags
  md: 10, // Inputs, interactive buttons
  lg: 16, // Main cards, modal sheets
  xl: 24, // Surface containers
  full: 9999 // Circular avatars, pill indicators
} as const;

export type RadiiToken = keyof typeof Radii;
