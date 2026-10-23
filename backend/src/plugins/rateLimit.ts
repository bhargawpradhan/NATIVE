import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

async function rateLimitPluginAsync(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: false, // Apply rate limiting explicitly on sensitive routes
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`
    })
  });
}

export const rateLimitPlugin = fp(rateLimitPluginAsync, {
  name: 'rate-limit-plugin'
});
