import React, { createContext, useContext, useEffect, useState } from 'react';
import { RequestOtpResponse, User, VerifyOtpResponse } from '../types';
import { ApiClient } from './api-client';
import { TokenStorage } from './token-storage';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requestOtp: (phone: string) => Promise<RequestOtpResponse>;
  verifyOtp: (phone: string, otp: string) => Promise<VerifyOtpResponse>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const storedToken = await TokenStorage.getToken();
        if (!storedToken) {
          if (isMounted) {
            setUser(null);
            setToken(null);
            setIsLoading(false);
          }
          return;
        }

        // Validate token against backend GET /api/v1/auth/me
        const { user: profile } = await ApiClient.getMe();
        if (isMounted) {
          setUser(profile);
          setToken(storedToken);
        }
      } catch {
        // Token is invalid, expired or backend unreachable with 401
        await TokenStorage.deleteToken();
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const requestOtp = async (phone: string): Promise<RequestOtpResponse> => {
    return ApiClient.requestOtp(phone);
  };

  const verifyOtp = async (phone: string, otp: string): Promise<VerifyOtpResponse> => {
    const result = await ApiClient.verifyOtp(phone, otp);
    setUser(result.user);
    setToken(result.token);
    return result;
  };

  const signOut = async (): Promise<void> => {
    await TokenStorage.deleteToken();
    setUser(null);
    setToken(null);
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const { user: profile } = await ApiClient.getMe();
      setUser(profile);
    } catch {
      await signOut();
    }
  };

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    requestOtp,
    verifyOtp,
    signOut,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
