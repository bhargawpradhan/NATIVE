import { Loan, Prisma, PrismaClient } from '@prisma/client';
import { formatCalendarDate, getTodayCalendarDate, parseCalendarDate } from '../../shared/date.js';
import { CreateLoanInput, ListLoansQuery, SerializedLoan } from './loans.schemas.js';

export function serializeLoan(loan: Loan, todayDateStr: string = getTodayCalendarDate()): SerializedLoan {
  const dueDateStr = formatCalendarDate(loan.dueDate);
  const isRepaid = loan.repaidAt !== null;
  const isOverdue = !isRepaid && dueDateStr < todayDateStr;

  let status: 'ACTIVE' | 'OVERDUE' | 'REPAID' = 'ACTIVE';
  if (isRepaid) {
    status = 'REPAID';
  } else if (isOverdue) {
    status = 'OVERDUE';
  }

  return {
    id: loan.id,
    userId: loan.userId,
    friendName: loan.friendName,
    amount: new Prisma.Decimal(loan.amount).toFixed(2),
    dueDate: dueDateStr,
    isRepaid,
    repaidAt: loan.repaidAt ? loan.repaidAt.toISOString() : null,
    isOverdue,
    status,
    notes: loan.notes,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString()
  };
}

export class LoansService {
  constructor(private prisma: PrismaClient) {}

  async createLoan(
    userId: string,
    input: CreateLoanInput,
    referenceTodayDate?: string
  ): Promise<SerializedLoan> {
    const today = referenceTodayDate || getTodayCalendarDate();
    const dueDate = parseCalendarDate(input.dueDate);

    const loan = await this.prisma.loan.create({
      data: {
        userId,
        friendName: input.friendName,
        amount: new Prisma.Decimal(input.amount),
        dueDate,
        notes: input.notes
      }
    });

    return serializeLoan(loan, today);
  }

  async listLoans(
    userId: string,
    query: ListLoansQuery,
    referenceTodayDate?: string
  ): Promise<{ loans: SerializedLoan[]; pagination: { total: number; limit: number; offset: number } }> {
    const today = referenceTodayDate || getTodayCalendarDate();
    const todayDateObj = parseCalendarDate(today);

    // Build user-isolated where clause
    const where: Prisma.LoanWhereInput = {
      userId
    };

    if (query.status === 'repaid') {
      where.repaidAt = { not: null };
    } else if (query.status === 'active') {
      where.repaidAt = null;
      where.dueDate = { gte: todayDateObj };
    } else if (query.status === 'overdue') {
      where.repaidAt = null;
      where.dueDate = { lt: todayDateObj };
    }

    const [total, rawLoans] = await Promise.all([
      this.prisma.loan.count({ where }),
      this.prisma.loan.findMany({
        where,
        orderBy: {
          [query.sort]: query.order
        },
        skip: query.offset,
        take: query.limit
      })
    ]);

    const loans = rawLoans.map((l) => serializeLoan(l, today));

    return {
      loans,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset
      }
    };
  }

  async getLoanById(
    userId: string,
    loanId: string,
    referenceTodayDate?: string
  ): Promise<SerializedLoan | null> {
    const today = referenceTodayDate || getTodayCalendarDate();

    // Query scoped strictly by userId and loanId to prevent ID guessing
    const loan = await this.prisma.loan.findFirst({
      where: {
        id: loanId,
        userId
      }
    });

    if (!loan) {
      return null;
    }

    return serializeLoan(loan, today);
  }

  async markLoanRepaid(
    userId: string,
    loanId: string,
    referenceTodayDate?: string
  ): Promise<{ status: 'SUCCESS'; loan: SerializedLoan } | { status: 'NOT_FOUND' } | { status: 'ALREADY_REPAID' }> {
    const today = referenceTodayDate || getTodayCalendarDate();

    // First check loan ownership and current status
    const existing = await this.prisma.loan.findFirst({
      where: {
        id: loanId,
        userId
      }
    });

    if (!existing) {
      return { status: 'NOT_FOUND' };
    }

    if (existing.repaidAt !== null) {
      return { status: 'ALREADY_REPAID' };
    }

    // Atomic conditional update to handle concurrent repayment calls safely
    const now = new Date();
    const updateResult = await this.prisma.loan.updateMany({
      where: {
        id: loanId,
        userId,
        repaidAt: null
      },
      data: {
        repaidAt: now
      }
    });

    if (updateResult.count === 0) {
      return { status: 'ALREADY_REPAID' };
    }

    const updated = await this.prisma.loan.findUniqueOrThrow({
      where: { id: loanId }
    });

    return {
      status: 'SUCCESS',
      loan: serializeLoan(updated, today)
    };
  }
}
