import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SummaryService } from './summary.service.js';

export const summaryRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const summaryService = new SummaryService(app.prisma);

  // GET /api/v1/summary
  app.get(
    '/api/v1/summary',
    {
      onRequest: [app.authenticate]
    },
    async (request, reply) => {
      const summary = await summaryService.getSummary(request.user.userId);
      return reply.status(200).send({ summary });
    }
  );
};
