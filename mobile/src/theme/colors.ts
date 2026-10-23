/**
 * MiniLedger Design System - Semantic Color Tokens
 * Tailored for a crisp, high-contrast, professional fintech aesthetic.
 */

export const Colors = {
  // Canvas & Surfaces
  background: '#F8FAFC', // Slate 50 (warm off-white)
  surface: '#FFFFFF', // Pure white card surfaces
  surfaceSubtle: '#F1F5F9', // Slate 100 for tags/pills
  surfaceMuted: '#E2E8F0', // Slate 200 for pressed states

  // Borders & Dividers
  border: '#E2E8F0', // Slate 200 crisp card borders
  borderSubtle: '#F1F5F9', // Slate 100 table row dividers
  borderFocus: '#2563EB', // Blue 600 active input focus

  // Typography Tokens
  textPrimary: '#0F172A', // Slate 900 (deep ink)
  textSecondary: '#475569', // Slate 600 (body & timestamps)
  textMuted: '#94A3B8', // Slate 400 (placeholders, captions)
  textInverse: '#FFFFFF', // White text on dark buttons

  // Brand & Action
  brandPrimary: '#0F172A', // Slate 900 primary button fill
  brandPrimaryPressed: '#1E293B', // Slate 800
  brandAccent: '#2563EB', // Blue 600 interactive links & active states
  brandAccentSubtle: '#EFF6FF', // Blue 50 light highlight

  // Semantic Financial Status Tokens
  statusOverdue: {
    text: '#DC2626', // Red 600
    background: '#FEF2F2', // Red 50
    border: '#FECACA' // Red 200
  },
  statusActive: {
    text: '#D97706', // Amber 600
    background: '#FFFBEB', // Amber 50
    border: '#FDE68A' // Amber 200
  },
  statusRepaid: {
    text: '#059669', // Emerald 600
    background: '#ECFDF5', // Emerald 50
    border: '#A7F3D0' // Emerald 200
  }
} as const;

export type ColorToken = keyof typeof Colors;
