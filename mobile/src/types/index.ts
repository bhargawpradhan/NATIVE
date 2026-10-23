export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'REPAID';

export type LoanFilterStatus = 'all' | 'active' | 'overdue' | 'repaid';

export interface Loan {
  id: string;
  userId: string;
  friendName: string;
  amount: string; // Fixed two-decimal string e.g. "2500.00"
  dueDate: string; // YYYY-MM-DD
  isRepaid: boolean;
  repaidAt: string | null;
  isOverdue: boolean; // Derived dynamically by backend in APP_TIME_ZONE
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryCounts {
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
  repaidLoans: number;
}

export interface Summary {
  totalLent: string;
  totalRepaid: string;
  overdueAmount: string;
  outstandingAmount: string;
  counts: SummaryCounts;
}

export interface User {
  id: string;
  phone: string;
  createdAt: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  services: {
    api: 'up' | 'down';
    database: 'connected' | 'disconnected';
  };
  error?: string;
}

export interface RequestOtpResponse {
  success: boolean;
  message: string;
  expiresInSeconds: number;
}

export interface VerifyOtpResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface LoansResponse {
  loans: Loan[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ApiErrorDetail {
  field?: string;
  issue?: string;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: ApiErrorDetail[];
}
