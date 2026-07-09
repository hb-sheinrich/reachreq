import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'http://localhost:8080']
      : true,
    credentials: true,
  });
}
