import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';

const PORT = Number(process.env.API_PORT ?? 8787);
const HOST = process.env.API_HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(sensible);

app.get('/healthz', async () => ({ ok: true }));

await app.listen({ port: PORT, host: HOST });
