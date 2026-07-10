import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';

const mentionRegex = /@([^\s@]+(?:\s[^\s@]+)?)/g;

const textAnchorSchema = z.object({
  field: z.string(),
  start: z.number(),
  end: z.number(),
});

const commentCreateSchema = z.object({
  requirementId: z.string().optional(),
  glossaryEntryId: z.string().optional(),
  versionId: z.string().optional(),
  parentId: z.string().optional(),
  content: z.string().min(1),
  textAnchor: textAnchorSchema.optional(),
  mentions: z.array(z.string().uuid()).default([]),
});

const commentUpdateSchema = z.object({
  content: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
});

const authorSelect = { select: { id: true, name: true } };
const mentionInclude = { include: { user: { select: { id: true, name: true, email: true } } } };
const replyInclude = {
  author: authorSelect,
  mentions: mentionInclude,
  replies: {
    include: {
      author: authorSelect,
      mentions: mentionInclude,
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

function buildWhere(query: Record<string, string | undefined>) {
  const where: any = {};
  if (query.requirementId) where.requirementId = query.requirementId;
  if (query.glossaryEntryId) where.glossaryEntryId = query.glossaryEntryId;
  return where;
}

function buildTree(comments: any[]): any[] {
  const map = new Map<string, any>();
  const roots: any[] = [];
  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }
  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId).replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

async function buildMentionList(content: string, explicitIds: string[]) {
  const ids = new Set<string>(explicitIds);
  const matches = content.match(mentionRegex);
  if (matches) {
    for (const raw of matches) {
      const name = raw.slice(1).trim();
      if (!name) continue;
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: name, mode: 'insensitive' } },
            { email: { contains: name, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 1,
      });
      users.forEach((u) => ids.add(u.id));
    }
  }
  return Array.from(ids);
}

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/comments', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const flat = await prisma.comment.findMany({
      where: buildWhere(query),
      include: { author: authorSelect, mentions: mentionInclude },
      orderBy: { createdAt: 'asc' },
    });
    return { comments: buildTree(flat) };
  });

  app.get('/api/requirements/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const flat = await prisma.comment.findMany({
      where: { requirementId: id },
      include: { author: authorSelect, mentions: mentionInclude },
      orderBy: { createdAt: 'asc' },
    });
    return { comments: buildTree(flat) };
  });

  app.get('/api/glossary/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const flat = await prisma.comment.findMany({
      where: { glossaryEntryId: id },
      include: { author: authorSelect, mentions: mentionInclude },
      orderBy: { createdAt: 'asc' },
    });
    return { comments: buildTree(flat) };
  });

  app.post('/api/comments', async (req, reply) => {
    const parsed = commentCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
    const mentionIds = await buildMentionList(data.content, data.mentions);

    const comment = await prisma.comment.create({
      data: {
        requirementId: data.requirementId,
        glossaryEntryId: data.glossaryEntryId,
        versionId: data.versionId,
        parentId: data.parentId,
        content: data.content,
        textAnchor: data.textAnchor,
        authorId: req.user.sub,
        mentions: {
          create: mentionIds.map((userId) => ({ userId })),
        },
      },
      include: replyInclude,
    });

    void audit('comment', comment.id, 'CREATE', req.user.sub, { requirementId: data.requirementId, glossaryEntryId: data.glossaryEntryId });
    return { comment };
  });

  app.patch('/api/comments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = commentUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Comment not found' });
    if (existing.authorId !== req.user.sub && !req.user.isAdmin) {
      return reply.status(403).send({ error: 'Not allowed' });
    }

    const updateData: any = {};
    if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

    if (parsed.data.content !== undefined) {
      const mentions = await buildMentionList(parsed.data.content, []);
      await prisma.commentMention.deleteMany({ where: { commentId: id } });
      await prisma.commentMention.createMany({ data: mentions.map((userId) => ({ commentId: id, userId })) });
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: updateData,
      include: replyInclude,
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
