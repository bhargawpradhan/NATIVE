import { buildApp } from './app.js';
import { env } from './config/env.js';

async function start() {
  const app = await buildApp({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
              }
            }
          : undefined
    }
  });

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`MiniLedger Backend service listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
