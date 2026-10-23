import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requestOtpSchema, verifyOtpSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const authService = new AuthService(app.prisma);

  // POST /api/v1/auth/request-otp
  app.post(
    '/api/v1/auth/request-otp',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes'
        }
      }
    },
    async (request, reply) => {
      const input = requestOtpSchema.parse(request.body);
      const result = await authService.requestOtp(input.phone, request.log);
      return reply.status(200).send(result);
    }
  );

  // POST /api/v1/auth/verify-otp
  app.post(
    '/api/v1/auth/verify-otp',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '10 minutes'
        }
      }
    },
    async (request, reply) => {
      const input = verifyOtpSchema.parse(request.body);
      const user = await authService.verifyOtp(input.phone, input.otp);

      const token = app.jwt.sign({
        userId: user.id,
        phone: user.phone
      });

      return reply.status(200).send({
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          createdAt: user.createdAt.toISOString()
        }
      });
    }
  );

  // GET /api/v1/auth/me
  app.get(
    '/api/v1/auth/me',
    {
      onRequest: [app.authenticate]
    },
    async (request, reply) => {
      const user = await authService.getMe(request.user.userId);

      if (!user) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'User not found or account removed'
        });
      }

      return reply.status(200).send({
        user: {
          id: user.id,
          phone: user.phone,
          createdAt: user.createdAt.toISOString()
        }
      });
    }
  );
};
