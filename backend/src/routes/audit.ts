import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/audit', async (req, reply) => {
    if (!req.user.isAdmin) return reply.status(403).send({ error: 'Admin required' });

    const schema = z.object({
      skip: z.coerce.number().default(0),
      take: z.coerce.number().max(100).default(50),
      entityType: z.string().optional(),
      action: z.string().optional(),
      userId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { skip, take, entityType, action, userId } = parsed.data;
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  });
}
