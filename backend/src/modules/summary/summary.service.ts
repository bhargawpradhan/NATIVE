import { Prisma, PrismaClient } from '@prisma/client';
import { getTodayCalendarDate, parseCalendarDate } from '../../shared/date.js';

export interface SummaryResult {
  totalLent: string;
  totalRepaid: string;
  overdueAmount: string;
  outstandingAmount: string;
  counts: {
    totalLoans: number;
    activeLoans: number;
    overdueLoans: number;
    repaidLoans: number;
  };
}

export class SummaryService {
  constructor(private prisma: PrismaClient) {}

  async getSummary(userId: string, referenceTodayDate?: string): Promise<SummaryResult> {
    const today = referenceTodayDate || getTodayCalendarDate();
    const todayDateObj = parseCalendarDate(today);

    // Parallel aggregate queries scoped strictly to authenticated userId
    const [totalLentAgg, totalRepaidAgg, overdueAgg, activeCount] = await Promise.all([
      // Total lent across all loans
      this.prisma.loan.aggregate({
        where: { userId },
        _sum: { amount: true },
        _count: { id: true }
      }),

      // Total repaid loans
      this.prisma.loan.aggregate({
        where: {
          userId,
          repaidAt: { not: null }
        },
        _sum: { amount: true },
        _count: { id: true }
      }),

      // Overdue loans: not repaid and due date strictly before today
      this.prisma.loan.aggregate({
        where: {
          userId,
          repaidAt: null,
          dueDate: { lt: todayDateObj }
        },
        _sum: { amount: true },
        _count: { id: true }
      }),

      // Active loans count: not repaid and due today or in the future
      this.prisma.loan.count({
        where: {
          userId,
          repaidAt: null,
          dueDate: { gte: todayDateObj }
        }
      })
    ]);

    const zero = new Prisma.Decimal(0);
    const totalLent = totalLentAgg._sum.amount ?? zero;
    const totalRepaid = totalRepaidAgg._sum.amount ?? zero;
    const overdueAmount = overdueAgg._sum.amount ?? zero;
    const outstandingAmount = totalLent.minus(totalRepaid);

    return {
      totalLent: totalLent.toFixed(2),
      totalRepaid: totalRepaid.toFixed(2),
      overdueAmount: overdueAmount.toFixed(2),
      outstandingAmount: outstandingAmount.toFixed(2),
      counts: {
        totalLoans: totalLentAgg._count.id,
        activeLoans: activeCount,
        overdueLoans: overdueAgg._count.id,
        repaidLoans: totalRepaidAgg._count.id
      }
    };
  }
}
