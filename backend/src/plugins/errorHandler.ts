import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

async function errorHandlerPluginAsync(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | Error, _request: FastifyRequest, reply: FastifyReply) => {
    app.log.error(error);

    // Zod validation errors
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message
      }));

      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Input validation failed',
        details
      });
    }

    // Fastify schema validation errors
    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
        details: error.validation
      });
    }

    // Explicit Fastify HTTP errors
    const statusCode = (error as FastifyError).statusCode || 500;
    const message = statusCode >= 500 ? 'Internal Server Error' : error.message;

    const defaultErrorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable'
    };

    const errorName =
      (error as any).error ||
      (error.name && error.name !== 'Error' ? error.name : defaultErrorNames[statusCode] || 'Error');

    return reply.status(statusCode).send({
      statusCode,
      error: errorName,
      message
    });
  });
}

export const errorHandlerPlugin = fp(errorHandlerPluginAsync, {
  name: 'error-handler-plugin'
});
