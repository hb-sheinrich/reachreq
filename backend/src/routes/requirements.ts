import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';
import { reviewRequirement } from '../services/ai.js';
import { getEnv } from '../lib/env.js';

function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user.isAdmin) {
    reply.status(403).send({ error: 'Admin permission required' });
    return false;
  }
  return true;
}

function isEditable(status: string) {
  return status === 'DRAFT' || status === 'IN_REVIEW';
}

function buildRequirementWhere(query: Record<string, string | undefined>) {
  const where: any = {};
  if (query.moduleId) where.moduleId = query.moduleId;
  if (query.status) where.status = query.status;
  if (query.classification) where.classification = query.classification;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
      { humanReadableId: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return where;
}

async function createVersion(tx: any, requirement: any, data: any, authorId: string, changeComment?: string) {
  const latest = await tx.requirementVersion.findFirst({
    where: { requirementId: requirement.id },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  return tx.requirementVersion.create({
    data: {
      requirementId: requirement.id,
      versionNumber,
      title: data.title,
      description: data.description,
      context: data.context,
      acceptanceCriteria: data.acceptanceCriteria ?? [],
      classification: data.classification,
      moduleId: data.moduleId,
      source: data.source,
      changeComment,
      authorId,
    },
  });
}

async function checkAiReview(
  requirementId: string,
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
    const result = await reviewRequirement({
      type: 'requirement',
      title: data.title,
      description: data.description ?? '',
      context: data.context ?? undefined,
      acceptanceCriteria: data.acceptanceCriteria,
      source: data.source ?? undefined,
    });
    review = await prisma.aIReview.create({
      data: {
        requirementId,
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

export async function requirementRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/requirements', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const skip = Math.max(0, Number(query.skip) || 0);
    const take = Math.max(1, Math.min(100, Number(query.take) || 50));
    const where = buildRequirementWhere(query);

    const [requirements, total] = await Promise.all([
      prisma.requirement.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.requirement.count({ where }),
    ]);

    return { requirements, total };
  });

  app.post('/api/requirements', async (req, reply) => {
    const schema = z.object({
      moduleId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      context: z.string().optional(),
      acceptanceCriteria: z.array(z.string()).default([]),
      classification: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE', 'WONT_HAVE']).default('MUST_HAVE'),
      source: z.string().optional(),
      status: z.enum(['DRAFT', 'IN_REVIEW']).default('DRAFT'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;

    const module = await prisma.module.update({
      where: { id: data.moduleId },
      data: { sequenceCounter: { increment: 1 } },
    });

    const requirement = await prisma.requirement.create({
      data: {
        humanReadableId: `MOD-${module.code}-${String(module.sequenceCounter).padStart(4, '0')}`,
        moduleId: data.moduleId,
        title: data.title,
        description: data.description,
        context: data.context,
        acceptanceCriteria: data.acceptanceCriteria,
        classification: data.classification,
        source: data.source,
        status: data.status,
        authorId: req.user.sub,
      },
      include: {
        module: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
      },
    });

    void audit('requirement', requirement.id, 'CREATE', req.user.sub, { title: data.title });
    return { requirement };
  });

  app.get('/api/requirements/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        module: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
        frozenBy: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
        _count: { select: { comments: true } },
      },
    });
    if (!requirement) return reply.status(404).send({ error: 'Requirement not found' });
    return { requirement };
  });

  app.patch('/api/requirements/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      context: z.string().optional().nullable(),
      acceptanceCriteria: z.array(z.string()).optional(),
      classification: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE', 'WONT_HAVE']).optional(),
      source: z.string().optional().nullable(),
      moduleId: z.string().optional(),
      status: z.enum(['DRAFT', 'IN_REVIEW']).optional(),
      editVersion: z.number(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;

    const current = await prisma.requirement.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (!isEditable(current.status)) {
      return reply.status(403).send({ error: 'Requirement is frozen or submitted and cannot be edited directly' });
    }

    const { editVersion, ...rest } = data;
    const updateData: any = { ...rest };
    if (rest.acceptanceCriteria !== undefined) updateData.acceptanceCriteria = rest.acceptanceCriteria;
    if (rest.description === null) updateData.description = null;
    if (rest.context === null) updateData.context = null;

    const updatedCount = await prisma.requirement.updateMany({
      where: { id, editVersion },
      data: { ...updateData, editVersion: { increment: 1 } },
    });

    if (updatedCount.count === 0) {
      return reply.status(409).send({ error: 'Conflict: requirement was modified by someone else' });
    }

    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        module: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('requirement', id, 'UPDATE', req.user.sub, { editVersion });
    return { requirement };
  });

  app.post('/api/requirements/:id/edit', async (req, reply) => {
    const { id } = req.params as { id: string };
    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { currentVersion: true },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });

    if (current.status === 'DRAFT' || current.status === 'IN_REVIEW') {
      return { requirement: current };
    }

    const snapshot = current.currentVersion;
    const updated = await prisma.requirement.update({
      where: { id },
      data: {
        status: 'DRAFT',
        statusComment: null,
        title: snapshot?.title ?? current.title,
        description: snapshot?.description ?? current.description,
        context: snapshot?.context ?? current.context,
        acceptanceCriteria: snapshot?.acceptanceCriteria ?? current.acceptanceCriteria,
        classification: snapshot?.classification ?? current.classification,
        moduleId: snapshot?.moduleId ?? current.moduleId,
        source: snapshot?.source ?? current.source,
        editVersion: { increment: 1 },
      },
      include: {
        module: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('requirement', id, 'REOPEN_DRAFT', req.user.sub, { previousStatus: current.status });
    return { requirement: updated };
  });

  app.post('/api/requirements/:id/submit', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      changeComment: z.string().optional(),
      aiReviewId: z.string().optional(),
      ignoreWarningsReason: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { changeComment, aiReviewId, ignoreWarningsReason } = parsed.data;

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { currentVersion: true },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (!isEditable(current.status)) {
      return reply.status(403).send({ error: 'Requirement is not in an editable state' });
    }

    const aiCheck = await checkAiReview(id, aiReviewId, ignoreWarningsReason, current, req.user.sub);
    if (!aiCheck.ok) {
      return reply.status(400).send({ error: aiCheck.message, aiReview: aiCheck.review });
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const version = await createVersion(tx, current, current, req.user.sub, changeComment);

        const updatedCount = await tx.requirement.updateMany({
          where: { id, editVersion: current.editVersion },
          data: {
            currentVersionId: version.id,
            status: 'SUBMITTED_FOR_RELEASE',
            statusComment: null,
            editVersion: { increment: 1 },
          },
        });

        if (updatedCount.count === 0) {
          throw new Error('Conflict');
        }

        await tx.aIReview.updateMany({
          where: { id: aiReviewId },
          data: { requirementId: current.id },
        });

        return tx.requirement.findUnique({
          where: { id },
          include: {
            module: { select: { id: true, name: true, code: true } },
            author: { select: { id: true, name: true } },
            currentVersion: { select: { id: true, versionNumber: true } },
          },
        });
      });

      void audit('requirement', id, 'SUBMIT', req.user.sub, { changeComment, aiReviewId });
      return { requirement: updated };
    } catch (err) {
      if (err instanceof Error && err.message === 'Conflict') {
        return reply.status(409).send({ error: 'Conflict: requirement was modified' });
      }
      throw err;
    }
  });

  app.post('/api/requirements/:id/approve', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.requirement.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (current.status !== 'SUBMITTED_FOR_RELEASE') {
      return reply.status(400).send({ error: 'Only submitted requirements can be approved' });
    }

    const updated = await prisma.requirement.update({
      where: { id },
      data: {
        status: 'APPROVED',
        frozenById: req.user.sub,
        frozenAt: new Date(),
        statusComment: parsed.data.statusComment,
      },
      include: {
        module: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
        frozenBy: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('requirement', id, 'APPROVE', req.user.sub, { statusComment: parsed.data.statusComment });
    return { requirement: updated };
  });

  app.post('/api/requirements/:id/reject', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.requirement.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (current.status !== 'SUBMITTED_FOR_RELEASE') {
      return reply.status(400).send({ error: 'Only submitted requirements can be rejected' });
    }

    const updated = await prisma.requirement.update({
      where: { id },
      data: { status: 'REJECTED', statusComment: parsed.data.statusComment },
      include: {
        module: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('requirement', id, 'REJECT', req.user.sub, { statusComment: parsed.data.statusComment });
    return { requirement: updated };
  });

  app.post('/api/requirements/:id/reopen', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.requirement.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (current.status !== 'APPROVED' && current.status !== 'REJECTED' && current.status !== 'POSTPONED') {
      return reply.status(400).send({ error: 'Requirement cannot be reopened' });
    }

    const updated = await prisma.requirement.update({
      where: { id },
      data: { status: 'DRAFT', statusComment: parsed.data.statusComment },
      include: {
        module: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });

    void audit('requirement', id, 'REOPEN', req.user.sub, { statusComment: parsed.data.statusComment });
    return { requirement: updated };
  });

  app.post('/api/requirements/:id/rollback', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ versionId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { author: { select: { id: true } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (!req.user.isAdmin && req.user.sub !== current.authorId) {
      return reply.status(403).send({ error: 'Not allowed' });
    }

    const version = await prisma.requirementVersion.findFirst({
      where: { id: parsed.data.versionId, requirementId: id },
    });
    if (!version) return reply.status(404).send({ error: 'Version not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const newVersion = await createVersion(tx, current, version, req.user.sub, `Rollback zu Version ${version.versionNumber}`);
      return tx.requirement.update({
        where: { id },
        data: {
          currentVersionId: newVersion.id,
          status: 'DRAFT',
          title: newVersion.title,
          description: newVersion.description,
          context: newVersion.context,
          acceptanceCriteria: newVersion.acceptanceCriteria,
          classification: newVersion.classification,
          moduleId: newVersion.moduleId,
          source: newVersion.source,
          statusComment: null,
          editVersion: { increment: 1 },
        },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
        },
      });
    });

    void audit('requirement', id, 'ROLLBACK', req.user.sub, { versionId: version.id });
    return { requirement: updated };
  });

  app.get('/api/requirements/:id/versions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const versions = await prisma.requirementVersion.findMany({
      where: { requirementId: id },
      orderBy: { versionNumber: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
        aiReview: { select: { id: true, status: true, result: true } },
      },
    });
    return { versions };
  });

  app.post('/api/requirements/:id/ai-review', async (req, reply) => {
    const { id } = req.params as { id: string };
    const current = await prisma.requirement.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });

    const review = await prisma.aIReview.create({
      data: {
        requirementId: id,
        authorId: req.user.sub,
        status: 'PENDING',
        result: {},
      },
    });

    try {
      const result = await reviewRequirement({
        type: 'requirement',
        title: current.title,
        description: current.description ?? '',
        context: current.context ?? undefined,
        acceptanceCriteria: current.acceptanceCriteria,
        source: current.source ?? undefined,
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

  app.get('/api/requirements/:id/ai-reviews', async (req, reply) => {
    const { id } = req.params as { id: string };
    const reviews = await prisma.aIReview.findMany({
      where: { requirementId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { aiReviews: reviews };
  });

  app.get('/api/requirements/:id/links', async (req, reply) => {
    const { id } = req.params as { id: string };
    const [fromLinks, toLinks] = await Promise.all([
      prisma.requirementLink.findMany({
        where: { fromId: id },
        include: { toRequirement: { select: { id: true, humanReadableId: true, title: true } } },
      }),
      prisma.requirementLink.findMany({
        where: { toId: id },
        include: { fromRequirement: { select: { id: true, humanReadableId: true, title: true } } },
      }),
    ]);
    return { from: fromLinks, to: toLinks };
  });

  app.post('/api/requirements/:id/links', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ toId: z.string(), type: z.enum(['DEPENDENCY', 'CONFLICT', 'DUPLICATE', 'RELATED']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.requirementLink.findUnique({
      where: { fromId_toId_type: { fromId: id, toId: parsed.data.toId, type: parsed.data.type } },
    });
    if (existing) return reply.status(409).send({ error: 'Link already exists' });

    const link = await prisma.requirementLink.create({
      data: { fromId: id, toId: parsed.data.toId, type: parsed.data.type },
      include: {
        fromRequirement: { select: { id: true, humanReadableId: true, title: true } },
        toRequirement: { select: { id: true, humanReadableId: true, title: true } },
      },
    });

    void audit('requirement_link', link.id, 'CREATE', req.user.sub, { fromId: id, ...parsed.data });
    return { link };
  });

  app.delete('/api/requirements/:id/links/:linkId', async (req, reply) => {
    const { linkId } = req.params as { linkId: string };
    const link = await prisma.requirementLink.findUnique({ where: { id: linkId } });
    if (!link) return reply.status(404).send({ error: 'Link not found' });

    await prisma.requirementLink.delete({ where: { id: linkId } });
    void audit('requirement_link', linkId, 'DELETE', req.user.sub, {});
    return { success: true };
  });

  app.get('/api/requirements/:id/glossary-links', async (req, reply) => {
    const { id } = req.params as { id: string };
    const links = await prisma.requirementGlossaryLink.findMany({
      where: { requirementId: id },
      include: { glossaryEntry: { select: { id: true, term: true, status: true } } },
    });
    return { links: links.map((l) => l.glossaryEntry) };
  });

  app.post('/api/requirements/:id/glossary-links', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ glossaryEntryIds: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    await prisma.$transaction(async (tx) => {
      await tx.requirementGlossaryLink.deleteMany({ where: { requirementId: id } });
      for (const glossaryEntryId of parsed.data.glossaryEntryIds) {
        await tx.requirementGlossaryLink.create({
          data: { requirementId: id, glossaryEntryId },
        });
      }
    });

    void audit('requirement_glossary', id, 'UPDATE', req.user.sub, { glossaryEntryIds: parsed.data.glossaryEntryIds });
    return { success: true };
  });
}
