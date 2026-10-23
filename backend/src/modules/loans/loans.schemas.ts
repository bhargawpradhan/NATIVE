import { z } from 'zod';
import { isValidCalendarDate } from '../../shared/date.js';

export const createLoanSchema = z.object({
  friendName: z
    .string({ required_error: 'Friend name is required' })
    .trim()
    .min(1, 'Friend name cannot be empty')
    .max(100, 'Friend name must be at most 100 characters'),
  amount: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === 'number' ? val.toFixed(2) : val.trim()))
    .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), {
      message: 'Amount must be a positive number with at most 2 decimal places'
    })
    .refine((val) => Number.parseFloat(val) > 0, {
      message: 'Amount must be strictly greater than 0'
    })
    .refine((val) => Number.parseFloat(val) <= 100000000.0, {
      message: 'Amount exceeds maximum permitted limit of 100,000,000.00'
    })
    .transform((val) => Number.parseFloat(val).toFixed(2)),
  dueDate: z
    .string({ required_error: 'Due date is required' })
    .refine((val) => isValidCalendarDate(val), {
      message: 'Due date must be a valid calendar date in YYYY-MM-DD format'
    }),
  notes: z
    .string()
    .max(500, 'Notes must be at most 500 characters')
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null))
});

export const listLoansQuerySchema = z.object({
  status: z.enum(['all', 'active', 'overdue', 'repaid']).default('all'),
  sort: z.enum(['dueDate', 'amount', 'createdAt']).default('dueDate'),
  order: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const loanIdParamSchema = z.object({
  id: z.string({ required_error: 'Loan ID parameter is required' }).min(1)
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;
export type LoanIdParam = z.infer<typeof loanIdParamSchema>;

export interface SerializedLoan {
  id: string;
  userId: string;
  friendName: string;
  amount: string; // Fixed two-decimal string e.g. "2500.00"
  dueDate: string; // YYYY-MM-DD
  isRepaid: boolean;
  repaidAt: string | null;
  isOverdue: boolean; // Derived dynamically
  status: 'ACTIVE' | 'OVERDUE' | 'REPAID';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
