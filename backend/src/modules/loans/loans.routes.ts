import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createLoanSchema, listLoansQuerySchema, loanIdParamSchema } from './loans.schemas.js';
import { LoansService } from './loans.service.js';

export const loansRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const loansService = new LoansService(app.prisma);

  // POST /api/v1/loans
  app.post(
    '/api/v1/loans',
    {
      onRequest: [app.authenticate]
    },
    async (request, reply) => {
      const input = createLoanSchema.parse(request.body);
      const loan = await loansService.createLoan(request.user.userId, input);
      return reply.status(201).send({ loan });
    }
  );

  // GET /api/v1/loans
  app.get(
    '/api/v1/loans',
    {
      onRequest: [app.authenticate]
    },
    async (request, reply) => {
      const query = listLoansQuerySchema.parse(request.query);
      const result = await loansService.listLoans(request.user.userId, query);
      return reply.status(200).send(result);
    }
  );

  // GET /api/v1/loans/:id
  app.get(
    '/api/v1/loans/:id',
    {
      onRequest: [app.authenticate]
    },
    async (request, reply) => {
      const params = loanIdParamSchema.parse(request.params);
      const loan = await loansService.getLoanById(request.user.userId, params.id);

      if (!loan) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Loan not found'
        });
      }

      return reply.status(200).send({ loan });
    }
  );

  // PATCH /api/v1/loans/:id/repay
  app.patch(
    '/api/v1/loans/:id/repay',
    {
      onRequest: [app.authenticate]
    },
    async (request, reply) => {
      const params = loanIdParamSchema.parse(request.params);
      const result = await loansService.markLoanRepaid(request.user.userId, params.id);

      if (result.status === 'NOT_FOUND') {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Loan not found'
        });
      }

      if (result.status === 'ALREADY_REPAID') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Loan has already been marked as repaid'
        });
      }

      return reply.status(200).send({
        success: true,
        loan: result.loan
      });
    }
  );
};
