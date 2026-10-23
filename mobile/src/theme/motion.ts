/**
 * MiniLedger Design System - Motion & Animation Tokens
 * Restrained, subtle transitions optimized for 60/120fps native performance.
 */

export const Motion = {
  // Duration in milliseconds
  durationFast: 150,
  durationNormal: 250,
  durationSlow: 350,

  // Press feedback opacity
  activeOpacity: 0.75,
  disabledOpacity: 0.4
} as const;

export type MotionToken = keyof typeof Motion;
