// Deployment trigger: 2026-02-04 v2
import { buildServer } from './server.js';

const app = buildServer();

const start = async () => {
  try {
    await app.ready();

    // Always prefer container/Azure PORT when present
    const port = Number(process.env.PORT ?? process.env.API_PORT ?? app.config.API_PORT ?? 3000);

    // IMPORTANT: In containers/Azure we must bind to all interfaces.
    // Only override if explicitly set.
    const host = process.env.API_HOST ?? '0.0.0.0';

    await app.listen({ port, host });
    app.log.info(`Server listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  try {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
