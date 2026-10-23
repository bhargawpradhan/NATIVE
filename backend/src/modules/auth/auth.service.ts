import crypto from 'node:crypto';
import { PrismaClient, User } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { env } from '../../config/env.js';
import { maskPhone, normalizePhone } from './auth.schemas.js';

export function generateSecureOtp(): string {
  // Generate cryptographically secure 6-digit decimal string [100000, 999999]
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', env.OTP_HASH_SECRET).update(otp).digest('hex');
}

export function verifyOtpHash(inputOtp: string, expectedHash: string): boolean {
  const computedHash = hashOtp(inputOtp);
  if (computedHash.length !== expectedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(computedHash, 'utf-8'), Buffer.from(expectedHash, 'utf-8'));
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generates and records an OTP challenge for the given phone number.
   *
   * Concurrency & Serialization:
   * Uses a PostgreSQL transaction-level advisory lock (`pg_advisory_xact_lock(4201, hashtext(phone))`)
   * inside a database transaction to serialize concurrent requests for the same normalized phone number.
   * This guarantees atomic execution across:
   * 1. 60-second cooldown verification
   * 2. 10-minute rolling window maximum count verification (max 5 requests)
   * 3. Invalidation of any prior active challenges for the phone
   * 4. Creation of the new OTP challenge
   *
   * Different phone numbers have distinct lock keys and execute fully in parallel.
   *
   * Development / Assessment Note:
   * This mock-OTP dispatch logs the generated code to the server terminal. In production,
   * this would be replaced with an external SMS gateway (e.g. Twilio, AWS SNS, Karix).
   */
  async requestOtp(
    rawPhone: string,
    logger?: FastifyBaseLogger
  ): Promise<{ success: true; message: string; expiresInSeconds: number }> {
    const phone = normalizePhone(rawPhone);
    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_IN_SECONDS * 1000);

    // Atomically execute rate-limit checks, challenge invalidation, and new challenge creation
    // under a PostgreSQL transaction-level advisory lock scoped to the normalized phone number.
    await this.prisma.$transaction(async (tx) => {
      // 1. Acquire transaction-level advisory lock for this normalized phone number.
      // 4201 is MiniLedger's unique advisory namespace for OTP issuance.
      // hashtext(phone) computes a deterministic 32-bit integer hash of the canonical phone string.
      // Any concurrent request for the same phone will wait until this transaction commits or rolls back.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4201, hashtext(${phone}))`;

      const now = Date.now();

      // 2. Cooldown check: reject if last OTP was issued < OTP_COOLDOWN_SECONDS ago
      const cooldownCutoff = new Date(now - env.OTP_COOLDOWN_SECONDS * 1000);
      const recentChallenge = await tx.otpChallenge.findFirst({
        where: {
          phone,
          createdAt: { gte: cooldownCutoff }
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });

      if (recentChallenge) {
        const retryAfterMs = recentChallenge.createdAt.getTime() + env.OTP_COOLDOWN_SECONDS * 1000 - now;
        const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
        const err = new Error(`Too many requests. Please try again in ${retryAfterSec} seconds.`) as any;
        err.statusCode = 429;
        err.name = 'Too Many Requests';
        throw err;
      }

      // 3. Rolling window check: reject if phone has >= OTP_MAX_ISSUANCE_PER_WINDOW in window
      const windowCutoff = new Date(now - env.OTP_ISSUANCE_WINDOW_SECONDS * 1000);
      const issuanceCount = await tx.otpChallenge.count({
        where: {
          phone,
          createdAt: { gte: windowCutoff }
        }
      });

      if (issuanceCount >= env.OTP_MAX_ISSUANCE_PER_WINDOW) {
        const err = new Error('Too many requests. Please try again later.') as any;
        err.statusCode = 429;
        err.name = 'Too Many Requests';
        throw err;
      }

      // 4. Invalidate prior unconsumed challenges for this phone
      await tx.otpChallenge.updateMany({
        where: {
          phone,
          consumedAt: null
        },
        data: {
          consumedAt: new Date()
        }
      });

      // 5. Persist new challenge
      await tx.otpChallenge.create({
        data: {
          phone,
          otpHash,
          expiresAt,
          attempts: 0
        }
      });
    });

    // Prominently log the mock OTP to development terminal output (with masked phone)
    const logBox = `
======================================================
[MOCK OTP DISPATCH]
Phone: ${maskPhone(phone)}
OTP: ${otp}
Expires in: ${env.OTP_EXPIRES_IN_SECONDS / 60} minutes
======================================================`;

    if (logger) {
      logger.info(logBox);
    } else if (env.NODE_ENV !== 'test') {
      console.log(logBox);
    }

    return {
      success: true,
      message: 'OTP sent to server terminal log',
      expiresInSeconds: env.OTP_EXPIRES_IN_SECONDS
    };
  }

  async verifyOtp(rawPhone: string, inputOtp: string): Promise<User> {
    const phone = normalizePhone(rawPhone);
    const now = new Date();

    // Find the latest unconsumed challenge for this phone
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!challenge) {
      const err = new Error('No active OTP challenge found. Please request a new OTP.') as any;
      err.statusCode = 400;
      throw err;
    }

    // Check expiry
    if (challenge.expiresAt < now) {
      const err = new Error('OTP code has expired. Please request a new OTP.') as any;
      err.statusCode = 400;
      throw err;
    }

    // Check attempt threshold
    if (challenge.attempts >= env.MAX_OTP_ATTEMPTS) {
      const err = new Error('Maximum verification attempts exceeded. Please request a new OTP.') as any;
      err.statusCode = 400;
      throw err;
    }

    // Verify OTP using timing-safe comparison
    const isMatch = verifyOtpHash(inputOtp, challenge.otpHash);

    if (!isMatch) {
      // Increment attempt counter
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } }
      });

      const err = new Error('Invalid OTP code') as any;
      err.statusCode = 400;
      throw err;
    }

    // Atomic consumption guard: ensures concurrency safety
    const consumeResult = await this.prisma.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null
      },
      data: {
        consumedAt: now
      }
    });

    if (consumeResult.count === 0) {
      const err = new Error('OTP has already been used. Please request a new OTP.') as any;
      err.statusCode = 400;
      throw err;
    }

    // Retrieve or create the user record
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone }
    });

    return user;
  }

  async getMe(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId }
    });
  }
}
