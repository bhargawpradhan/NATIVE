import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp, getTestPrisma } from './helpers/test-db.js';

describe('GET /health endpoint', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    app = await createTestApp(prisma);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns 200 healthy when PostgreSQL is connected and responsive', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('healthy');
    expect(body.services.api).toBe('up');
    expect(body.services.database).toBe('connected');
    expect(body.timestamp).toBeDefined();
  });

  it('returns 503 degraded when database connectivity fails', async () => {
    // Temporarily mock isDbConnected to return false
    const originalIsDbConnected = app.isDbConnected;
    app.isDbConnected = vi.fn().mockResolvedValue(false);

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('degraded');
    expect(body.services.api).toBe('up');
    expect(body.services.database).toBe('disconnected');
    expect(body.error).toBe('Database connectivity check failed');

    // Restore
    app.isDbConnected = originalIsDbConnected;
  });
});
