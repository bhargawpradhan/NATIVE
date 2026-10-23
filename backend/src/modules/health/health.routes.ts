import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/health', async (_request, reply) => {
    const isDbUp = await app.isDbConnected();

    if (!isDbUp) {
      return reply.status(503).send({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          api: 'up',
          database: 'disconnected'
        },
        error: 'Database connectivity check failed'
      });
    }

    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database: 'connected'
      }
    });
  });
};
