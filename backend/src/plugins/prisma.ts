import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    isDbConnected: () => Promise<boolean>;
  }
}

export interface PrismaPluginOptions {
  prisma?: PrismaClient;
}

async function prismaPluginAsync(app: FastifyInstance, opts: PrismaPluginOptions = {}) {
  const prisma =
    opts.prisma ||
    new PrismaClient({
      log: app.log.level === 'debug' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error']
    });

  const isDbConnected = async (): Promise<boolean> => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  };

  app.decorate('prisma', prisma);
  app.decorate('isDbConnected', isDbConnected);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

export const prismaPlugin = fp(prismaPluginAsync, {
  name: 'prisma-plugin'
});
