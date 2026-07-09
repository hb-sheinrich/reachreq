import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/requirements/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const comments = await prisma.comment.findMany({
      where: { requirementId: id, parentId: null },
      include: { author: { select: { id: true, name: true } }, replies: { include: { author: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return { comments };
  });

  app.get('/api/glossary/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const comments = await prisma.comment.findMany({
      where: { glossaryEntryId: id, parentId: null },
      include: { author: { select: { id: true, name: true } }, replies: { include: { author: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return { comments };
  });

  app.post('/api/comments', async (req, reply) => {
    const schema = z.object({
      requirementId: z.string().optional(),
      glossaryEntryId: z.string().optional(),
      versionId: z.string().optional(),
      parentId: z.string().optional(),
      content: z.string().min(1),
      textAnchor: z.object({ field: z.string(), start: z.number(), end: z.number() }).optional(),
    }).refine((d) => d.requirementId || d.glossaryEntryId, { message: 'Either requirementId or glossaryEntryId required' });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
    const comment = await prisma.comment.create({
      data: {
        requirementId: data.requirementId,
        glossaryEntryId: data.glossaryEntryId,
        versionId: data.versionId,
        parentId: data.parentId,
        content: data.content,
        textAnchor: data.textAnchor,
        authorId: req.user.sub,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    void audit('comment', comment.id, 'CREATE', req.user.sub, { requirementId: data.requirementId, glossaryEntryId: data.glossaryEntryId });
    return { comment };
  });

  app.patch('/api/comments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ content: z.string().min(1), status: z.enum(['OPEN', 'RESOLVED']).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Comment not found' });
    if (existing.authorId !== req.user.sub && !req.user.isAdmin) {
      return reply.status(403).send({ error: 'Not allowed' });
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: parsed.data,
      include: { author: { select: { id: true, name: true } } },
    });

    void audit('comment', id, 'UPDATE', req.user.sub, parsed.data);
    return { comment: updated };
  });

  app.delete('/api/comments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Comment not found' });
    if (existing.authorId !== req.user.sub && !req.user.isAdmin) {
      return reply.status(403).send({ error: 'Not allowed' });
    }

    await prisma.comment.delete({ where: { id } });
    void audit('comment', id, 'DELETE', req.user.sub, {});
    return { success: true };
  });
}
