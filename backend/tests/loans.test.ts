import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LoansService } from '../src/modules/loans/loans.service.js';
import { cleanTestDatabase, createTestApp, getTestPrisma } from './helpers/test-db.js';

describe('Loans Module Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;

  beforeAll(async () => {
    app = await createTestApp(prisma);
    await app.ready();
  });

  beforeEach(async () => {
    await cleanTestDatabase(prisma);

    // Create User A
    const userA = await prisma.user.create({
      data: { phone: '+919876500021' }
    });
    userAId = userA.id;
    userAToken = app.jwt.sign({ userId: userA.id, phone: userA.phone });

    // Create User B
    const userB = await prisma.user.create({
      data: { phone: '+919876500022' }
    });
    userBId = userB.id;
    userBToken = app.jwt.sign({ userId: userB.id, phone: userB.phone });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/loans (Create Loan)', () => {
    it('creates a new active loan with valid inputs and returns 201 Created', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          friendName: 'Alice Smith',
          amount: '1500.50',
          dueDate: '2026-12-01',
          notes: 'Dinner and concert share'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.loan).toBeDefined();
      expect(body.loan.friendName).toBe('Alice Smith');
      expect(body.loan.amount).toBe('1500.50');
      expect(body.loan.dueDate).toBe('2026-12-01');
      expect(body.loan.isRepaid).toBe(false);
      expect(body.loan.repaidAt).toBeNull();
      expect(body.loan.status).toBe('ACTIVE');
      expect(body.loan.notes).toBe('Dinner and concert share');
      expect(body.loan.userId).toBe(userAId);
    });

    it('allows creating an overdue loan if due date is in the past', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          friendName: 'Bob Vance',
          amount: '200.00',
          dueDate: '2026-01-10' // past date
        }
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.loan.status).toBe('OVERDUE');
      expect(body.loan.isOverdue).toBe(true);
    });

    it('rejects empty or whitespace-only friend name with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          friendName: '   ',
          amount: '500.00',
          dueDate: '2026-11-20'
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toBe('Input validation failed');
    });

    it('rejects non-positive, zero or negative amounts with 400 Bad Request', async () => {
      for (const invalidAmount of ['0.00', '-50.00', '-1', '0']) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/loans',
          headers: { authorization: `Bearer ${userAToken}` },
          payload: {
            friendName: 'Test Friend',
            amount: invalidAmount,
            dueDate: '2026-11-20'
          }
        });

        expect(res.statusCode).toBe(400);
      }
    });

    it('rejects amounts with more than two decimal places with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          friendName: 'Test Friend',
          amount: '123.456',
          dueDate: '2026-11-20'
        }
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects impossible calendar dates (e.g. 2026-02-31) with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          friendName: 'Test Friend',
          amount: '100.00',
          dueDate: '2026-02-31' // February never has 31 days
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.message).toBe('Input validation failed');
    });

    it('requires Bearer token authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/loans',
        payload: {
          friendName: 'Alice',
          amount: '100.00',
          dueDate: '2026-11-20'
        }
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/loans (List & Filter Loans)', () => {
    beforeEach(async () => {
      const loansService = new LoansService(prisma);
      // User A loans:
      await loansService.createLoan(
        userAId,
        { friendName: 'Alice', amount: '100.00', dueDate: '2026-12-01', notes: null },
        '2026-10-23'
      );
      await loansService.createLoan(
        userAId,
        { friendName: 'Bob', amount: '250.00', dueDate: '2026-09-01', notes: null }, // Overdue
        '2026-10-23'
      );
      const repaidLoan = await loansService.createLoan(
        userAId,
        { friendName: 'Charlie', amount: '400.00', dueDate: '2026-11-01', notes: null },
        '2026-10-23'
      );
      await loansService.markLoanRepaid(userAId, repaidLoan.id, '2026-10-23');

      // User B loan (must be isolated and invisible to User A):
      await loansService.createLoan(
        userBId,
        { friendName: 'David (User B friend)', amount: '999.00', dueDate: '2026-12-01', notes: null },
        '2026-10-23'
      );
    });

    it('lists only loans belonging to the authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/loans',
        headers: { authorization: `Bearer ${userAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.loans.length).toBe(3);
      expect(body.pagination.total).toBe(3);

      // Verify none of User B's records leaked
      const names = body.loans.map((l: any) => l.friendName);
      expect(names).not.toContain('David (User B friend)');
    });

    it('filters loans by status: active, overdue, repaid', async () => {
      // Status = active
      const activeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/loans?status=active',
        headers: { authorization: `Bearer ${userAToken}` }
      });
      const activeBody = JSON.parse(activeRes.payload);
      expect(activeBody.loans.length).toBe(1);
      expect(activeBody.loans[0].friendName).toBe('Alice');

      // Status = overdue
      const overdueRes = await app.inject({
        method: 'GET',
        url: '/api/v1/loans?status=overdue',
        headers: { authorization: `Bearer ${userAToken}` }
      });
      const overdueBody = JSON.parse(overdueRes.payload);
      expect(overdueBody.loans.length).toBe(1);
      expect(overdueBody.loans[0].friendName).toBe('Bob');

      // Status = repaid
      const repaidRes = await app.inject({
        method: 'GET',
        url: '/api/v1/loans?status=repaid',
        headers: { authorization: `Bearer ${userAToken}` }
      });
      const repaidBody = JSON.parse(repaidRes.payload);
      expect(repaidBody.loans.length).toBe(1);
      expect(repaidBody.loans[0].friendName).toBe('Charlie');
    });

    it('supports sorting by amount descending and pagination bounds', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/loans?sort=amount&order=desc&limit=2&offset=0',
        headers: { authorization: `Bearer ${userAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.loans.length).toBe(2);
      expect(body.pagination.total).toBe(3);
      expect(Number.parseFloat(body.loans[0].amount)).toBeGreaterThanOrEqual(
        Number.parseFloat(body.loans[1].amount)
      );
    });
  });

  describe('GET /api/v1/loans/:id (Retrieve Loan)', () => {
    it('retrieves an owned loan by ID', async () => {
      const loansService = new LoansService(prisma);
      const loan = await loansService.createLoan(
        userAId,
        { friendName: 'Target Loan', amount: '350.00', dueDate: '2026-11-15', notes: 'Fuel' },
        '2026-10-23'
      );

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/loans/${loan.id}`,
        headers: { authorization: `Bearer ${userAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.loan.id).toBe(loan.id);
      expect(body.loan.friendName).toBe('Target Loan');
    });

    it('returns 404 Not Found when attempting to access another user loan by ID', async () => {
      // Loan created by User B
      const loansService = new LoansService(prisma);
      const loanB = await loansService.createLoan(
        userBId,
        { friendName: 'Private Loan', amount: '800.00', dueDate: '2026-11-15', notes: null },
        '2026-10-23'
      );

      // User A attempts to access User B's loan ID
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/loans/${loanB.id}`,
        headers: { authorization: `Bearer ${userAToken}` }
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.message).toBe('Loan not found');
    });
  });

  describe('PATCH /api/v1/loans/:id/repay (Mark Loan as Repaid)', () => {
    it('marks an active loan as repaid and records repayment timestamp', async () => {
      const loansService = new LoansService(prisma);
      const loan = await loansService.createLoan(
        userAId,
        { friendName: 'Active Friend', amount: '300.00', dueDate: '2026-12-10', notes: null },
        '2026-10-23'
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/loans/${loan.id}/repay`,
        headers: { authorization: `Bearer ${userAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.loan.isRepaid).toBe(true);
      expect(body.loan.repaidAt).not.toBeNull();
      expect(body.loan.status).toBe('REPAID');
    });

    it('returns 409 Conflict when attempting to repay an already repaid loan', async () => {
      const loansService = new LoansService(prisma);
      const loan = await loansService.createLoan(
        userAId,
        { friendName: 'Settled Friend', amount: '300.00', dueDate: '2026-12-10', notes: null },
        '2026-10-23'
      );

      // First repayment
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/loans/${loan.id}/repay`,
        headers: { authorization: `Bearer ${userAToken}` }
      });

      // Second repayment call -> MUST return 409 Conflict
      const res2 = await app.inject({
        method: 'PATCH',
        url: `/api/v1/loans/${loan.id}/repay`,
        headers: { authorization: `Bearer ${userAToken}` }
      });

      expect(res2.statusCode).toBe(409);
      const body2 = JSON.parse(res2.payload);
      expect(body2.error).toBe('Conflict');
      expect(body2.message).toBe('Loan has already been marked as repaid');
    });

    it('returns 404 Not Found when attempting to repay another user loan', async () => {
      const loansService = new LoansService(prisma);
      const loanB = await loansService.createLoan(
        userBId,
        { friendName: 'User B Friend', amount: '500.00', dueDate: '2026-12-10', notes: null },
        '2026-10-23'
      );

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/loans/${loanB.id}/repay`,
        headers: { authorization: `Bearer ${userAToken}` }
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
