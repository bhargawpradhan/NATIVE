import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LoansService } from '../src/modules/loans/loans.service.js';
import { formatCalendarDate, getTodayCalendarDate, parseCalendarDate } from '../src/shared/date.js';
import { cleanTestDatabase, createTestApp, getTestPrisma } from './helpers/test-db.js';

describe('Financial Summary Integration Tests (GET /api/v1/summary)', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;

  // Use the dynamic today date evaluated in APP_TIME_ZONE so tests stay aligned across midnight
  const referenceToday = getTodayCalendarDate();

  beforeAll(async () => {
    app = await createTestApp(prisma);
    await app.ready();
  });

  beforeEach(async () => {
    await cleanTestDatabase(prisma);

    const userA = await prisma.user.create({
      data: { phone: '+919876500031' }
    });
    userAId = userA.id;
    userAToken = app.jwt.sign({ userId: userA.id, phone: userA.phone });

    const userB = await prisma.user.create({
      data: { phone: '+919876500032' }
    });
    userBId = userB.id;
    userBToken = app.jwt.sign({ userId: userB.id, phone: userB.phone });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns exact zero amounts ("0.00") and zero counts for a user with no loans', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/summary',
      headers: { authorization: `Bearer ${userAToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.summary).toEqual({
      totalLent: '0.00',
      totalRepaid: '0.00',
      overdueAmount: '0.00',
      outstandingAmount: '0.00',
      counts: {
        totalLoans: 0,
        activeLoans: 0,
        overdueLoans: 0,
        repaidLoans: 0
      }
    });
  });

  it('computes exact financial aggregates across active, overdue, today, yesterday, and repaid loans', async () => {
    const loansService = new LoansService(prisma);
    const todayDate = parseCalendarDate(referenceToday);

    // Compute relative dates anchored to dynamic referenceToday
    const futureDate = new Date(todayDate);
    futureDate.setDate(futureDate.getDate() + 20);
    const futureDateStr = formatCalendarDate(futureDate);

    const todayStr = referenceToday;

    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayDateStr = formatCalendarDate(yesterdayDate);

    const pastDate = new Date(todayDate);
    pastDate.setDate(pastDate.getDate() - 60);
    const pastDateStr = formatCalendarDate(pastDate);

    const repaidDate = new Date(todayDate);
    repaidDate.setDate(repaidDate.getDate() - 30);
    const repaidDateStr = formatCalendarDate(repaidDate);

    // 1. Active loan due in future (amount 1000.50)
    await loansService.createLoan(
      userAId,
      { friendName: 'Alice Future', amount: '1000.50', dueDate: futureDateStr, notes: null },
      referenceToday
    );

    // 2. Active loan due today (amount 250.00) -> NOT overdue
    await loansService.createLoan(
      userAId,
      { friendName: 'Bob Today', amount: '250.00', dueDate: todayStr, notes: null },
      referenceToday
    );

    // 3. Overdue loan due yesterday (amount 500.25) -> OVERDUE
    await loansService.createLoan(
      userAId,
      { friendName: 'Charlie Yesterday', amount: '500.25', dueDate: yesterdayDateStr, notes: null },
      referenceToday
    );

    // 4. Overdue loan due 2 months ago (amount 300.00) -> OVERDUE
    await loansService.createLoan(
      userAId,
      { friendName: 'David Past', amount: '300.00', dueDate: pastDateStr, notes: null },
      referenceToday
    );

    // 5. Repaid loan (amount 700.00) -> REPAID (even though dueDate < today, it is settled so NOT in overdueAmount)
    const repaidLoan = await loansService.createLoan(
      userAId,
      { friendName: 'Emma Repaid', amount: '700.00', dueDate: repaidDateStr, notes: null },
      referenceToday
    );
    await loansService.markLoanRepaid(userAId, repaidLoan.id, referenceToday);

    // 6. User B loan (amount 9999.00) - MUST NOT BE INCLUDED IN USER A's SUMMARY
    await loansService.createLoan(
      userBId,
      { friendName: 'Other User Friend', amount: '9999.00', dueDate: futureDateStr, notes: null },
      referenceToday
    );

    // Calculations:
    // Total Lent = 1000.50 + 250.00 + 500.25 + 300.00 + 700.00 = 2750.75
    // Total Repaid = 700.00
    // Outstanding = 2750.75 - 700.00 = 2050.75
    // Overdue = 500.25 + 300.00 = 800.25
    // Counts: total = 5, active = 2 (future + today), overdue = 2 (yesterday + past), repaid = 1

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/summary',
      headers: { authorization: `Bearer ${userAToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.summary.totalLent).toBe('2750.75');
    expect(body.summary.totalRepaid).toBe('700.00');
    expect(body.summary.outstandingAmount).toBe('2050.75');
    expect(body.summary.overdueAmount).toBe('800.25');
    expect(body.summary.counts).toEqual({
      totalLoans: 5,
      activeLoans: 2,
      overdueLoans: 2,
      repaidLoans: 1
    });
  });

  it('verifies that repaying an overdue loan decreases overdue amount and leaves total lent unchanged', async () => {
    const loansService = new LoansService(prisma);

    const overdueLoan = await loansService.createLoan(
      userAId,
      { friendName: 'Overdue To Settle', amount: '450.00', dueDate: '2026-09-10', notes: null },
      referenceToday
    );

    // Check summary before repayment:
    const resBefore = await app.inject({
      method: 'GET',
      url: '/api/v1/summary',
      headers: { authorization: `Bearer ${userAToken}` }
    });
    const bodyBefore = JSON.parse(resBefore.payload);
    expect(bodyBefore.summary.totalLent).toBe('450.00');
    expect(bodyBefore.summary.totalRepaid).toBe('0.00');
    expect(bodyBefore.summary.overdueAmount).toBe('450.00');
    expect(bodyBefore.summary.outstandingAmount).toBe('450.00');

    // Mark as repaid:
    const repayRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/loans/${overdueLoan.id}/repay`,
      headers: { authorization: `Bearer ${userAToken}` }
    });
    expect(repayRes.statusCode).toBe(200);

    // Check summary after repayment:
    const resAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/summary',
      headers: { authorization: `Bearer ${userAToken}` }
    });
    const bodyAfter = JSON.parse(resAfter.payload);
    expect(bodyAfter.summary.totalLent).toBe('450.00'); // Unchanged
    expect(bodyAfter.summary.totalRepaid).toBe('450.00'); // Increased
    expect(bodyAfter.summary.overdueAmount).toBe('0.00'); // Decreased to 0.00
    expect(bodyAfter.summary.outstandingAmount).toBe('0.00'); // Decreased to 0.00
    expect(bodyAfter.summary.counts.overdueLoans).toBe(0);
    expect(bodyAfter.summary.counts.repaidLoans).toBe(1);

    // Repeating repayment request must fail with 409 Conflict and NOT change totals:
    const duplicateRepayRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/loans/${overdueLoan.id}/repay`,
      headers: { authorization: `Bearer ${userAToken}` }
    });
    expect(duplicateRepayRes.statusCode).toBe(409);

    const resAfterDuplicate = await app.inject({
      method: 'GET',
      url: '/api/v1/summary',
      headers: { authorization: `Bearer ${userAToken}` }
    });
    const bodyAfterDuplicate = JSON.parse(resAfterDuplicate.payload);
    expect(bodyAfterDuplicate.summary).toEqual(bodyAfter.summary);
  });
});
