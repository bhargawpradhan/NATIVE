import {
  HealthResponse,
  Loan,
  LoanFilterStatus,
  LoansResponse,
  RequestOtpResponse,
  Summary,
  User,
  VerifyOtpResponse
} from '../types';
import { Config } from './config';
import { TokenStorage } from './token-storage';

export class ApiError extends Error {
  statusCode: number;
  error: string;
  details?: unknown;

  constructor(statusCode: number, error: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  requiresAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, requiresAuth = false } = options;

  let url = `${Config.apiUrl}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  if (requiresAuth) {
    const token = await TokenStorage.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Config.timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timer);

    let responseData: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      responseData = { message: text || `HTTP ${response.status} Error` };
    }

    if (!response.ok) {
      const statusCode = response.status;
      const error = responseData?.error || 'Request Failed';
      const message = responseData?.message || `Request failed with status ${statusCode}`;
      const details = responseData?.details;

      // If unauthorized, clear invalid token
      if (statusCode === 401 && requiresAuth) {
        await TokenStorage.deleteToken();
      }

      throw new ApiError(statusCode, error, message, details);
    }

    return responseData as T;
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof ApiError) {
      throw err;
    }

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new ApiError(
          408,
          'Request Timeout',
          `Connection timed out after ${Config.timeoutMs / 1000}s. Ensure backend is running at ${Config.apiUrl}.`
        );
      }
      throw new ApiError(
        0,
        'Network Error',
        `Unable to connect to server at ${Config.apiUrl}. Please verify your network connection.`
      );
    }

    throw new ApiError(0, 'Unknown Error', 'An unexpected error occurred while communicating with the server.');
  }
}

export const ApiClient = {
  // Public Health Check
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  // Auth Endpoints
  async requestOtp(phone: string): Promise<RequestOtpResponse> {
    return request<RequestOtpResponse>('/api/v1/auth/request-otp', {
      method: 'POST',
      body: { phone }
    });
  },

  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
    const result = await request<VerifyOtpResponse>('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: { phone, otp }
    });
    if (result.token) {
      await TokenStorage.setToken(result.token);
    }
    return result;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/v1/auth/me', {
      requiresAuth: true
    });
  },

  // Summary Endpoint
  async getSummary(): Promise<{ summary: Summary }> {
    return request<{ summary: Summary }>('/api/v1/summary', {
      requiresAuth: true
    });
  },

  // Loans Endpoints
  async getLoans(query?: {
    status?: LoanFilterStatus;
    sort?: 'dueDate' | 'amount' | 'createdAt';
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<LoansResponse> {
    return request<LoansResponse>('/api/v1/loans', {
      requiresAuth: true,
      params: query as Record<string, string | number | undefined>
    });
  },

  async getLoanById(id: string): Promise<{ loan: Loan }> {
    return request<{ loan: Loan }>(`/api/v1/loans/${id}`, {
      requiresAuth: true
    });
  },

  async createLoan(data: {
    friendName: string;
    amount: string;
    dueDate: string;
    notes?: string | null;
  }): Promise<{ loan: Loan }> {
    return request<{ loan: Loan }>('/api/v1/loans', {
      method: 'POST',
      body: data,
      requiresAuth: true
    });
  },

  async markLoanRepaid(id: string): Promise<{ success: boolean; loan: Loan }> {
    return request<{ success: boolean; loan: Loan }>(`/api/v1/loans/${id}/repay`, {
      method: 'PATCH',
      requiresAuth: true
    });
  }
};
