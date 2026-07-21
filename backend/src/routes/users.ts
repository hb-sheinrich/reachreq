import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const search = (query.search || '').trim();

    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: { id: true, name: true, email: true },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return { users };
  });
}
