import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { corsPlugin } from './plugins/cors.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';
import { jwtPlugin } from './plugins/jwt.js';
import { prismaPlugin } from './plugins/prisma.js';
import { rateLimitPlugin } from './plugins/rateLimit.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { loansRoutes } from './modules/loans/loans.routes.js';
import { summaryRoutes } from './modules/summary/summary.routes.js';

export interface BuildAppOptions extends FastifyServerOptions {
  prisma?: PrismaClient;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { prisma, ...serverOpts } = opts;
  const app = fastify(serverOpts);

  // Core Infrastructure Plugins
  await app.register(corsPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(prismaPlugin, { prisma });
  await app.register(jwtPlugin);
  await app.register(rateLimitPlugin);

  // Application Modules
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(loansRoutes);
  await app.register(summaryRoutes);

  return app;
}
