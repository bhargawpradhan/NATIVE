/**
 * MiniLedger Mobile Client Configuration
 *
 * For physical device testing using Expo Go:
 * Set EXPO_PUBLIC_API_URL in mobile/.env to your development machine's LAN IP,
 * for example: EXPO_PUBLIC_API_URL=http://192.168.1.50:4000
 */

export const Config = {
  // Uses environment variable if defined, falling back to localhost for emulator / web preview
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
  apiPrefix: '/api/v1',
  timeoutMs: 10000
} as const;
