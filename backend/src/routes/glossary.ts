import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';
import { reviewGlossary } from '../services/ai.js';
import { getEnv } from '../lib/env.js';

function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user.isAdmin) {
    reply.status(403).send({ error: 'Admin permission required' });
    return false;
  }
  return true;
}

async function createVersion(tx: any, entry: any, data: any, authorId: string, changeComment?: string) {
  const latest = await tx.glossaryVersion.findFirst({
    where: { glossaryEntryId: entry.id },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  return tx.glossaryVersion.create({
    data: {
      glossaryEntryId: entry.id,
      versionNumber,
      term: data.term,
      definition: data.definition,
      example: data.example,
      tags: data.tags ?? [],
      status: data.status,
      changeComment,
      authorId,
    },
  });
}

async function checkAiReview(
  glossaryEntryId: string,
  aiReviewId: string | undefined,
  ignoreWarningsReason: string | undefined,
  data: any,
  authorId: string
) {
  if (!getEnv().ANTHROPIC_API_KEY) return { ok: true };

  let review = null;
  if (aiReviewId) {
    review = await prisma.aIReview.findUnique({ where: { id: aiReviewId } });
  }

  if (!review) {
    const result = await reviewGlossary({
      type: 'glossary',
      title: data.term,
      description: data.definition,
      term: data.term,
      definition: data.definition,
      example: data.example ?? undefined,
    });
    review = await prisma.aIReview.create({
      data: {
        glossaryEntryId,
        authorId,
        status: 'COMPLETED',
        result: result as any,
      },
    });
  }

  if (review.status === 'FAILED' || !review.result) {
    return { ok: false, message: 'KI-Prüfung fehlgeschlagen' };
  }

  const result = review.result as { passed?: boolean; blockers?: unknown[]; warnings?: unknown[] };
  if (result.blockers && Array.isArray(result.blockers) && result.blockers.length > 0) {
    return { ok: false, message: 'KI-Prüfung enthält Blocker. Bitte korrigiere zuerst die gemeldeten Probleme.' };
  }
  if (result.warnings && Array.isArray(result.warnings) && result.warnings.length > 0 && !ignoreWarningsReason) {
    return { ok: false, message: 'KI-Prüfung enthält Warnungen. Bitte begründe, warum du sie ignoriert.' };
  }

  return { ok: true, review };
}

export async function glossaryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/glossary', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (query.moduleId) where.moduleId = query.moduleId;
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { term: { contains: query.q, mode: 'insensitive' } },
        { definition: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.glossaryEntry.findMany({
        where,
        orderBy: { term: 'asc' },
        include: {
          module: { select: { id: true, name: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
        },
      }),
      prisma.glossaryEntry.count({ where }),
    ]);

    return { entries, total };
  });

  app.post('/api/glossary', async (req, reply) => {
    const schema = z.object({
      term: z.string().min(1),
      definition: z.string().min(1),
      example: z.string().optional(),
      tags: z.array(z.string()).default([]),
      moduleId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;

    const entry = await prisma.glossaryEntry.create({
      data: {
        term: data.term,
        definition: data.definition,
        example: data.example,
        tags: data.tags,
        status: 'DRAFT',
        moduleId: data.moduleId,
        authorId: req.user.sub,
      },
      include: {
        module: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    });

    void audit('glossary', entry.id, 'CREATE', req.user.sub, { term: data.term });
    return { entry };
  });

  app.get('/api/glossary/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const entry = await prisma.glossaryEntry.findUnique({
      where: { id },
      include: {
        module: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });
    if (!entry) return reply.status(404).send({ error: 'Glossary entry not found' });
    return { entry };
  });

  app.patch('/api/glossary/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      term: z.string().min(1).optional(),
      definition: z.string().min(1).optional(),
      example: z.string().optional().nullable(),
      tags: z.array(z.string()).optional(),
      moduleId: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;

    const current = await prisma.glossaryEntry.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Glossary entry not found' });
    if (current.status === 'APPROVED') {
      return reply.status(403).send({ error: 'Approved glossary entries cannot be edited directly' });
    }

    const entry = await prisma.glossaryEntry.update({
      where: { id },
      data,
      include: {
        module: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('glossary', id, 'UPDATE', req.user.sub, data);
    return { entry };
  });

  app.delete('/api/glossary/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    await prisma.glossaryEntry.delete({ where: { id } });
    void audit('glossary', id, 'DELETE', req.user.sub, {});
    return { success: true };
  });

  app.post('/api/glossary/:id/submit', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      changeComment: z.string().optional(),
      aiReviewId: z.string().optional(),
      ignoreWarningsReason: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { changeComment, aiReviewId, ignoreWarningsReason } = parsed.data;

    const current = await prisma.glossaryEntry.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Glossary entry not found' });
    if (current.status !== 'DRAFT') {
      return reply.status(403).send({ error: 'Only draft entries can be submitted' });
    }

    const aiCheck = await checkAiReview(id, aiReviewId, ignoreWarningsReason, current, req.user.sub);
    if (!aiCheck.ok) {
      return reply.status(400).send({ error: aiCheck.message, aiReview: aiCheck.review });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const version = await createVersion(tx, current, current, req.user.sub, changeComment);
      return tx.glossaryEntry.update({
        where: { id },
        data: {
          currentVersionId: version.id,
          status: 'SUBMITTED_FOR_RELEASE',
          statusComment: null,
        },
        include: {
          module: { select: { id: true, name: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
        },
      });
    });

    void audit('glossary', id, 'SUBMIT', req.user.sub, { changeComment, aiReviewId });
    return { entry: updated };
  });

  app.post('/api/glossary/:id/approve', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.glossaryEntry.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Glossary entry not found' });
    if (current.status !== 'SUBMITTED_FOR_RELEASE') {
      return reply.status(400).send({ error: 'Only submitted entries can be approved' });
    }

    const updated = await prisma.glossaryEntry.update({
      where: { id },
      data: { status: 'APPROVED', statusComment: parsed.data.statusComment },
      include: {
        module: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('glossary', id, 'APPROVE', req.user.sub, { statusComment: parsed.data.statusComment });
    return { entry: updated };
  });

  app.post('/api/glossary/:id/reject', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.glossaryEntry.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Glossary entry not found' });
    if (current.status !== 'SUBMITTED_FOR_RELEASE') {
      return reply.status(400).send({ error: 'Only submitted entries can be rejected' });
    }

    const updated = await prisma.glossaryEntry.update({
      where: { id },
      data: { status: 'REJECTED', statusComment: parsed.data.statusComment },
      include: {
        module: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('glossary', id, 'REJECT', req.user.sub, { statusComment: parsed.data.statusComment });
    return { entry: updated };
  });

  app.post('/api/glossary/:id/reopen', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.glossaryEntry.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Glossary entry not found' });
    if (current.status !== 'APPROVED' && current.status !== 'REJECTED') {
      return reply.status(400).send({ error: 'Entry cannot be reopened' });
    }

    const updated = await prisma.glossaryEntry.update({
      where: { id },
      data: { status: 'DRAFT', statusComment: parsed.data.statusComment },
      include: {
        module: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('glossary', id, 'REOPEN', req.user.sub, { statusComment: parsed.data.statusComment });
    return { entry: updated };
  });

  app.get('/api/glossary/:id/versions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const versions = await prisma.glossaryVersion.findMany({
      where: { glossaryEntryId: id },
      orderBy: { versionNumber: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
        aiReview: { select: { id: true, status: true, result: true } },
      },
    });
    return { versions };
  });

  app.post('/api/glossary/:id/ai-review', async (req, reply) => {
    const { id } = req.params as { id: string };
    const current = await prisma.glossaryEntry.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Glossary entry not found' });

    const review = await prisma.aIReview.create({
      data: {
        glossaryEntryId: id,
        authorId: req.user.sub,
        status: 'PENDING',
        result: {},
      },
    });

    try {
      const result = await reviewGlossary({
        type: 'glossary',
        title: current.term,
        description: current.definition,
        term: current.term,
        definition: current.definition,
        example: current.example ?? undefined,
      });
      const updated = await prisma.aIReview.update({
        where: { id: review.id },
        data: { status: 'COMPLETED', result: result as any },
      });
      return { aiReview: updated };
    } catch (err) {
      const failed = await prisma.aIReview.update({
        where: { id: review.id },
        data: {
          status: 'FAILED',
          result: {
            passed: false,
            blockers: [{ field: 'ai', message: err instanceof Error ? err.message : 'AI-Prüfung fehlgeschlagen' }],
            warnings: [],
            suggestions: [],
          },
        },
      });
      return { aiReview: failed };
    }
  });

  app.get('/api/glossary/:id/ai-reviews', async (req, reply) => {
    const { id } = req.params as { id: string };
    const reviews = await prisma.aIReview.findMany({
      where: { glossaryEntryId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { aiReviews: reviews };
  });

  app.get('/api/glossary/:id/requirements', async (req, reply) => {
    const { id } = req.params as { id: string };
    const links = await prisma.requirementGlossaryLink.findMany({
      where: { glossaryEntryId: id },
      include: {
        requirement: {
          select: { id: true, humanReadableId: true, title: true, status: true },
        },
      },
    });
    return { requirements: links.map((l) => l.requirement) };
  });
}
