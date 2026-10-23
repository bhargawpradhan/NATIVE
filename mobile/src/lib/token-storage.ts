import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const JWT_KEY = 'miniledger_jwt_token';

// In-memory fallback if web localStorage is unavailable or in server-side render
let memoryToken: string | null = null;

export const TokenStorage = {
  /**
   * Retrieves the stored JWT token.
   * Uses native Expo SecureStore on iOS/Android, and localStorage with in-memory fallback on web.
   */
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(JWT_KEY);
        }
        return memoryToken;
      }
      return await SecureStore.getItemAsync(JWT_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Persists the JWT token securely.
   */
  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(JWT_KEY, token);
        }
        memoryToken = token;
        return;
      }
      await SecureStore.setItemAsync(JWT_KEY, token);
    } catch (error) {
      console.warn('Failed to persist authentication token');
    }
  },

  /**
   * Deletes the stored JWT token on sign-out.
   */
  async deleteToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(JWT_KEY);
        }
        memoryToken = null;
        return;
      }
      await SecureStore.deleteItemAsync(JWT_KEY);
    } catch {
      // Ignored
    }
  }
};
