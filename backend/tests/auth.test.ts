import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { cleanTestDatabase, createTestApp, getTestPrisma } from './helpers/test-db.js';

describe('Authentication Module Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    app = await createTestApp(prisma);
    await app.ready();
  });

  beforeEach(async () => {
    await cleanTestDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/request-otp', () => {
    it('generates a mock OTP challenge, prints it to log, and never leaks OTP in response', async () => {
      const phone = '+919876543210';
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-otp',
        payload: { phone }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe('OTP sent to server terminal log');
      expect(body.expiresInSeconds).toBe(env.OTP_EXPIRES_IN_SECONDS);

      // SECURITY CRITICAL: verify OTP code is NEVER in HTTP response
      expect(body.otp).toBeUndefined();
      expect(res.payload).not.toMatch(/\b\d{6}\b/);

      // Verify record was persisted in database with SHA-256 HMAC hash
      const challenge = await prisma.otpChallenge.findFirst({
        where: { phone }
      });
      expect(challenge).not.toBeNull();
      expect(challenge?.otpHash).toBeDefined();
      expect(challenge?.otpHash.length).toBe(64); // SHA-256 hex length
      expect(challenge?.attempts).toBe(0);
      expect(challenge?.consumedAt).toBeNull();
    });

    it('rejects invalid or malformed phone numbers with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-otp',
        payload: { phone: 'not-a-phone' }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toBe('Input validation failed');
      expect(body.details).toBeDefined();
    });

    it('invalidates older active challenges when a new OTP is requested for the same phone', async () => {
      const phone = '+919999888877';

      // Use AuthService directly to bypass HTTP-level rate limiting
      const authService = new AuthService(prisma);

      // First request
      await authService.requestOtp(phone);

      const firstChallenge = await prisma.otpChallenge.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' }
      });
      expect(firstChallenge?.consumedAt).toBeNull();

      // Backdate the first challenge to clear the cooldown window
      await prisma.otpChallenge.update({
        where: { id: firstChallenge!.id },
        data: { createdAt: new Date(Date.now() - 120_000) } // 2 minutes ago
      });

      // Second request (cooldown has now elapsed)
      await authService.requestOtp(phone);

      // Prior challenge should now be marked consumed / invalidated
      const prior = await prisma.otpChallenge.findUnique({
        where: { id: firstChallenge!.id }
      });
      expect(prior?.consumedAt).not.toBeNull();

      // New challenge should be active
      const active = await prisma.otpChallenge.findFirst({
        where: { phone, consumedAt: null }
      });
      expect(active?.id).not.toBe(firstChallenge!.id);
    });

    it('enforces 60-second cooldown per phone number on consecutive OTP requests', async () => {
      const phone = '+919876543211';

      // First OTP request succeeds
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-otp',
        payload: { phone }
      });
      expect(res1.statusCode).toBe(200);

      // Immediate second request for same phone is blocked by cooldown
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-otp',
        payload: { phone }
      });
      expect(res2.statusCode).toBe(429);
      const body2 = JSON.parse(res2.payload);
      expect(body2.error).toBe('Too Many Requests');
      expect(body2.message).toMatch(/Too many requests\. Please try again in \d+ seconds\./);

      // Verify no second active challenge was created in the database
      const challenges = await prisma.otpChallenge.findMany({
        where: { phone }
      });
      expect(challenges).toHaveLength(1);
    });

    it('enforces cooldown across phone number formatting variations (normalized phone)', async () => {
      // First request with spaces and formatting from IP A
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-otp',
        remoteAddress: '10.0.1.1',
        payload: { phone: '+91 98765 43212' }
      });
      expect(res1.statusCode).toBe(200);

      // Second request without spaces for same E.164 phone number from a different IP B
      // Verifies that changing IP address cannot bypass per-phone cooldown
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-otp',
        remoteAddress: '10.0.1.2',
        payload: { phone: '+919876543212' }
      });
      expect(res2.statusCode).toBe(429);
      const body2 = JSON.parse(res2.payload);
      expect(body2.error).toBe('Too Many Requests');
      expect(body2.message).toMatch(/Too many requests\. Please try again in \d+ seconds\./);
    });

    it('enforces rolling window limit of maximum 5 OTP requests per phone within 10 minutes', async () => {
      const phone = '+919876543213';
      const { hashOtp } = await import('../src/modules/auth/auth.service.js');

      // Seed 5 prior challenges for this phone spaced 70s apart (outside cooldown, inside 10m window)
      const now = Date.now();
      for (let i = 5; i >= 1; i--) {
        await prisma.otpChallenge.create({
          data: {
            phone,
            otpHash: hashOtp(`11111${i}`),
            expiresAt: new Date(now + 300_000),
            createdAt: new Date(now - i * 70_000), // 350s, 280s, 210s, 140s, 70s ago
            consumedAt: new Date(now - i * 70_000 + 10_000)
          }
        });
      }

      // Verify 5 challenges exist in database
      const count = await prisma.otpChallenge.count({ where: { phone } });
      expect(count).toBe(5);

      // Attempt 6th request from IP C (cooldown is cleared because last was 70s ago, but 10m window is full)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-otp',
        remoteAddress: '10.0.1.3',
        payload: { phone }
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('Too Many Requests');
      expect(body.message).toBe('Too many requests. Please try again later.');

      // Verify no 6th challenge was created
      const finalCount = await prisma.otpChallenge.count({ where: { phone } });
      expect(finalCount).toBe(5);
    });

    describe('Concurrency & Serialization Protection', () => {
      it('serializes concurrent OTP requests for the same phone: exactly one succeeds and remainder receive 429', async () => {
        const phone = '+919876500101';
        const concurrentRequests = 5;

        const results = await Promise.all(
          Array.from({ length: concurrentRequests }, (_, i) =>
            app.inject({
              method: 'POST',
              url: '/api/v1/auth/request-otp',
              remoteAddress: `10.1.0.${i + 1}`,
              payload: { phone }
            })
          )
        );

        const statusCodes = results.map((r) => r.statusCode);
        const successes = statusCodes.filter((code) => code === 200);
        const rateLimits = statusCodes.filter((code) => code === 429);

        // Deterministic: Exactly 1 request succeeds, all other 4 receive 429
        expect(successes).toHaveLength(1);
        expect(rateLimits).toHaveLength(concurrentRequests - 1);

        // Verify each 429 response has proper error payload
        for (const res of results.filter((r) => r.statusCode === 429)) {
          const body = JSON.parse(res.payload);
          expect(body.error).toBe('Too Many Requests');
          expect(body.message).toMatch(/Too many requests\. Please try again in \d+ seconds\./);
        }

        // Verify the database contains exactly 1 active challenge record
        const challenges = await prisma.otpChallenge.findMany({
          where: { phone }
        });
        expect(challenges).toHaveLength(1);
        expect(challenges[0].consumedAt).toBeNull();
      });

      it('allows concurrent requests for distinct phone numbers without blocking or interference', async () => {
        const phoneA = '+919876500102';
        const phoneB = '+919876500103';

        const [resA, resB] = await Promise.all([
          app.inject({
            method: 'POST',
            url: '/api/v1/auth/request-otp',
            remoteAddress: '10.2.0.1',
            payload: { phone: phoneA }
          }),
          app.inject({
            method: 'POST',
            url: '/api/v1/auth/request-otp',
            remoteAddress: '10.2.0.2',
            payload: { phone: phoneB }
          })
        ]);

        expect(resA.statusCode).toBe(200);
        expect(resB.statusCode).toBe(200);

        const countA = await prisma.otpChallenge.count({ where: { phone: phoneA } });
        const countB = await prisma.otpChallenge.count({ where: { phone: phoneB } });
        expect(countA).toBe(1);
        expect(countB).toBe(1);
      });

      it('prevents concurrent burst from exceeding rolling window limit of 5 challenges per 10 minutes', async () => {
        const phone = '+919876500104';
        const { hashOtp } = await import('../src/modules/auth/auth.service.js');

        // Seed 4 prior challenges (outside cooldown, inside 10-minute window)
        const now = Date.now();
        for (let i = 4; i >= 1; i--) {
          await prisma.otpChallenge.create({
            data: {
              phone,
              otpHash: hashOtp(`99990${i}`),
              expiresAt: new Date(now + 300_000),
              createdAt: new Date(now - i * 70_000), // 280s, 210s, 140s, 70s ago
              consumedAt: new Date(now - i * 70_000 + 5_000)
            }
          });
        }

        // Exactly 1 slot remaining before reaching the 5-request cap
        const initialCount = await prisma.otpChallenge.count({ where: { phone } });
        expect(initialCount).toBe(4);

        // Fire 3 simultaneous concurrent requests from distinct IPs
        const results = await Promise.all(
          [1, 2, 3].map((i) =>
            app.inject({
              method: 'POST',
              url: '/api/v1/auth/request-otp',
              remoteAddress: `10.3.0.${i}`,
              payload: { phone }
            })
          )
        );

        const statusCodes = results.map((r) => r.statusCode);
        const successes = statusCodes.filter((c) => c === 200);
        const rateLimits = statusCodes.filter((c) => c === 429);

        // Exactly 1 request succeeds (filling the 5th slot); the remaining 2 are rejected with 429
        expect(successes).toHaveLength(1);
        expect(rateLimits).toHaveLength(2);

        // Verify the total challenges created never exceeds the 5-request cap
        const finalCount = await prisma.otpChallenge.count({ where: { phone } });
        expect(finalCount).toBe(5);
      });

      it('enforces concurrency serialization across phone number formatting variations', async () => {
        const variations = [
          '+91 98765 00105',
          '+919876500105',
          '+91-98765-00105'
        ];

        const results = await Promise.all(
          variations.map((phoneVariant, i) =>
            app.inject({
              method: 'POST',
              url: '/api/v1/auth/request-otp',
              remoteAddress: `10.4.0.${i + 1}`,
              payload: { phone: phoneVariant }
            })
          )
        );

        const statusCodes = results.map((r) => r.statusCode);
        const successes = statusCodes.filter((c) => c === 200);
        const rateLimits = statusCodes.filter((c) => c === 429);

        // Exactly 1 request succeeds, the other 2 are blocked by cooldown
        expect(successes).toHaveLength(1);
        expect(rateLimits).toHaveLength(2);

        // Normalized phone record in database is exactly 1
        const normalized = '+919876500105';
        const challenges = await prisma.otpChallenge.findMany({ where: { phone: normalized } });
        expect(challenges).toHaveLength(1);
      });
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    it('verifies valid OTP, creates new user, and returns signed JWT token', async () => {
      const phone = '+919123456789';

      // Use AuthService directly to request OTP and capture mock code
      const authService = new AuthService(prisma);
      await authService.requestOtp(phone);

      const challenge = await prisma.otpChallenge.findFirstOrThrow({
        where: { phone, consumedAt: null }
      });

      // Verify using mock code 000000..999999 match
      let validOtp = '';
      for (let i = 100000; i <= 999999; i++) {
        const candidate = i.toString();
        const candidateHash = AuthService.prototype.requestOtp ? candidate : '';
        if (challenge.otpHash === candidateHash) {
          validOtp = candidate;
          break;
        }
      }

      // Or simply create an OTP challenge directly with known code
      const testOtp = '654321';
      const { hashOtp } = await import('../src/modules/auth/auth.service.js');
      await prisma.otpChallenge.create({
        data: {
          phone,
          otpHash: hashOtp(testOtp),
          expiresAt: new Date(Date.now() + 300000),
          attempts: 0
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        payload: {
          phone,
          otp: testOtp
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user.phone).toBe(phone);
      expect(body.user.id).toBeDefined();

      // Verify challenge was consumed atomically
      const consumedChallenge = await prisma.otpChallenge.findFirst({
        where: { phone, otpHash: hashOtp(testOtp) }
      });
      expect(consumedChallenge?.consumedAt).not.toBeNull();

      // Verify user created in database
      const user = await prisma.user.findUnique({
        where: { phone }
      });
      expect(user).not.toBeNull();
      expect(user?.id).toBe(body.user.id);
    });

    it('returns existing user account on subsequent logins without duplicating user record', async () => {
      const phone = '+919876500001';
      const existingUser = await prisma.user.create({
        data: { phone }
      });

      const testOtp = '112233';
      const { hashOtp } = await import('../src/modules/auth/auth.service.js');
      await prisma.otpChallenge.create({
        data: {
          phone,
          otpHash: hashOtp(testOtp),
          expiresAt: new Date(Date.now() + 300000)
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        payload: { phone, otp: testOtp }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user.id).toBe(existingUser.id);

      const totalUsers = await prisma.user.count({ where: { phone } });
      expect(totalUsers).toBe(1);
    });

    it('rejects incorrect OTP and increments attempt counter in database', async () => {
      const phone = '+919876500002';
      const { hashOtp } = await import('../src/modules/auth/auth.service.js');
      const challenge = await prisma.otpChallenge.create({
        data: {
          phone,
          otpHash: hashOtp('123456'),
          expiresAt: new Date(Date.now() + 300000),
          attempts: 0
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        payload: { phone, otp: '999999' }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.message).toBe('Invalid OTP code');

      const updated = await prisma.otpChallenge.findUnique({
        where: { id: challenge.id }
      });
      expect(updated?.attempts).toBe(1);
      expect(updated?.consumedAt).toBeNull();
    });

    it('rejects expired OTP with 400 Bad Request', async () => {
      const phone = '+919876500003';
      const { hashOtp } = await import('../src/modules/auth/auth.service.js');
      await prisma.otpChallenge.create({
        data: {
          phone,
          otpHash: hashOtp('123456'),
          expiresAt: new Date(Date.now() - 1000) // 1 second ago
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        payload: { phone, otp: '123456' }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.message).toMatch(/expired/i);
    });

    it('rejects reuse of an already consumed OTP', async () => {
      const phone = '+919876500004';
      const { hashOtp } = await import('../src/modules/auth/auth.service.js');
      await prisma.otpChallenge.create({
        data: {
          phone,
          otpHash: hashOtp('123456'),
          expiresAt: new Date(Date.now() + 300000),
          consumedAt: new Date()
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        payload: { phone, otp: '123456' }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.message).toMatch(/No active OTP challenge found/i);
    });

    it('blocks verification after exceeding maximum failed attempt threshold', async () => {
      const phone = '+919876500005';
      const { hashOtp } = await import('../src/modules/auth/auth.service.js');
      await prisma.otpChallenge.create({
        data: {
          phone,
          otpHash: hashOtp('123456'),
          expiresAt: new Date(Date.now() + 300000),
          attempts: env.MAX_OTP_ATTEMPTS
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        payload: { phone, otp: '123456' }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.message).toMatch(/Maximum verification attempts exceeded/i);
    });

    it('ensures atomic consumption under concurrent verification requests', async () => {
      const phone = '+919876500006';
      const { hashOtp } = await import('../src/modules/auth/auth.service.js');
      await prisma.otpChallenge.create({
        data: {
          phone,
          otpHash: hashOtp('555555'),
          expiresAt: new Date(Date.now() + 300000),
          attempts: 0
        }
      });

      // Fire two concurrent requests
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/verify-otp',
          payload: { phone, otp: '555555' }
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/verify-otp',
          payload: { phone, otp: '555555' }
        })
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode];
      expect(statusCodes).toContain(200);
      expect(statusCodes).toContain(400); // One must succeed, the other must fail with 400
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns authenticated user profile when provided valid Bearer token', async () => {
      const user = await prisma.user.create({
        data: { phone: '+919876500010' }
      });

      const token = app.jwt.sign({ userId: user.id, phone: user.phone });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user.id).toBe(user.id);
      expect(body.user.phone).toBe(user.phone);
    });

    it('rejects requests without authorization header with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me'
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Invalid or missing authentication token');
    });

    it('rejects requests with malformed or tampered token with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer invalid.tampered.token'
        }
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects requests with expired JWT token with 401 Unauthorized', async () => {
      const user = await prisma.user.create({
        data: { phone: '+919876500099' }
      });

      // Sign token with a fleeting 10ms expiration
      const token = app.jwt.sign(
        { userId: user.id, phone: user.phone },
        { expiresIn: '10ms' }
      );

      // Wait 50ms for token to expire
      await new Promise((resolve) => setTimeout(resolve, 50));

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Invalid or missing authentication token');
    });
  });
});
