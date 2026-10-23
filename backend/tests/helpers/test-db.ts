import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';

let testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    const testUrl = env.TEST_DATABASE_URL;

    // Strict safety guard: never run test teardown on non-test databases
    if (!testUrl.includes('miniledger_test') && !testUrl.includes('_test')) {
      throw new Error(
        `FATAL SAFETY ERROR: Attempted to run test suite against non-test database URL: "${testUrl}". ` +
          'Test execution aborted to prevent development database corruption.'
      );
    }

    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: testUrl
        }
      },
      log: ['error']
    });
  }

  return testPrisma;
}

export async function cleanTestDatabase(prisma: PrismaClient): Promise<void> {
  // Guard check before truncation
  const testUrl = env.TEST_DATABASE_URL;
  if (!testUrl.includes('miniledger_test') && !testUrl.includes('_test')) {
    throw new Error('Safety guard triggered: Refusal to truncate non-test database!');
  }

  // Delete in foreign key dependency order
  await prisma.loan.deleteMany({});
  await prisma.otpChallenge.deleteMany({});
  await prisma.user.deleteMany({});
}

export async function createTestApp(prismaClient: PrismaClient = getTestPrisma()): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: false,
    prisma: prismaClient
  });

  return app;
}
