import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';
import { reviewRequirement } from '../services/ai.js';
import { getEnv } from '../lib/env.js';
import { upsertRequirementTags } from '../services/tags.js';
import { createRequirementVersion } from '../services/versions.js';
import { createJiraIssue, buildUseCaseDescription } from '../services/jira.js';
import { translateUseCase, type UseCase, type UseCaseTranslation } from '../services/translation.js';

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

export function buildRequirementWhere(query: Record<string, string | undefined>) {
  const where: any = {};
  if (query.moduleId) where.moduleId = query.moduleId;
  if (query.status) where.status = query.status;
  if (query.classification) where.classification = query.classification;

  if (query.tags) {
    const tagNames = query.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagNames.length > 0) {
      where.tags = {
        some: { tag: { name: { in: tagNames } } },
      };
    }
  }

  if (query.q) {
    const q = query.q;
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { humanReadableId: { contains: q, mode: 'insensitive' } },
      { tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } } },
    ];
  }

  return where;
}

function mapTags(requirement: any): string[] {
  if (!requirement?.tags) return [];
  return requirement.tags.map((t: any) => (typeof t === 'string' ? t : t?.tag?.name)).filter(Boolean);
}

function stripTagObjects(requirement: any) {
  if (!requirement) return requirement;
  const { tags, ...rest } = requirement;
  return { ...rest, tags: mapTags(requirement) };
}

function buildOrderBy(query: Record<string, string | undefined>): any {
  const field = query.sortField;
  const order = query.sortOrder === '1' ? 'asc' : query.sortOrder === '-1' ? 'desc' : undefined;
  if (!field || !order) return { updatedAt: 'desc' };

  const allowed: Record<string, any> = {
    title: { title: order },
    status: { status: order },
    classification: { classification: order },
    humanReadableId: { humanReadableId: order },
    createdAt: { createdAt: order },
    updatedAt: { updatedAt: order },
    'module.name': { module: { name: order } },
    'author.name': { author: { name: order } },
  };

  return allowed[field] || { updatedAt: 'desc' };
}

async function buildUseCasePayload(requirement: any): Promise<UseCase> {
  return {
    title: requirement.title,
    description: requirement.description,
    context: requirement.context,
    acceptanceCriteria: requirement.acceptanceCriteria ?? [],
    goal: requirement.goal,
    precondition: requirement.precondition,
    postcondition: requirement.postcondition,
    mainFlow: requirement.mainFlow,
    alternativeFlows: requirement.alternativeFlows,
    technicalAppendix: requirement.technicalAppendix,
    aliases: [],
  };
}

async function applyRequirementTranslation(requirement: any, lang: string) {
  if (!lang || lang === requirement.originalLanguage) return requirement;

  const translation = await prisma.translation.findUnique({
    where: { requirementId_language: { requirementId: requirement.id, language: lang } },
  });

  if (!translation) return requirement;

  const merged = { ...requirement };
  if (translation.title !== null) merged.title = translation.title;
  if (translation.description !== null) merged.description = translation.description;
  if (translation.context !== null) merged.context = translation.context;
  if (translation.goal !== null) merged.goal = translation.goal;
  if (translation.precondition !== null) merged.precondition = translation.precondition;
  if (translation.postcondition !== null) merged.postcondition = translation.postcondition;
  if (translation.acceptanceCriteria && translation.acceptanceCriteria.length > 0) {
    merged.acceptanceCriteria = translation.acceptanceCriteria;
  }
  if (translation.mainFlow !== null) merged.mainFlow = translation.mainFlow;
  if (translation.alternativeFlows !== null) merged.alternativeFlows = translation.alternativeFlows;
  if (translation.technicalAppendix !== null) merged.technicalAppendix = translation.technicalAppendix;

  return merged;
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
    return { ok: false, message: 'KI-Prüfung enthält Blocker. Bitte korrigiere zuerst die gemeldeten Probleme.', review };
  }
  if (result.warnings && Array.isArray(result.warnings) && result.warnings.length > 0 && !ignoreWarningsReason) {
    return { ok: false, message: 'KI-Prüfung enthält Warnungen. Bitte begründe, warum du sie ignoriert.', review };
  }

  return { ok: true, review };
}

export async function requirementRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/requirements', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as Record<string, string | undefined>;
    const skip = Math.max(0, Number(query.skip) || 0);
    const take = Math.max(1, Math.min(100, Number(query.take) || 50));
    const where = buildRequirementWhere(query);

    const [requirements, total] = await Promise.all([
      prisma.requirement.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query),
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          _count: { select: { comments: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      }),
      prisma.requirement.count({ where }),
    ]);

    return { requirements: requirements.map(stripTagObjects), total };
  });

  app.post('/api/requirements', async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      moduleId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      context: z.string().optional(),
      acceptanceCriteria: z.array(z.string()).default([]),
      classification: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE', 'WONT_HAVE']).default('MUST_HAVE'),
      source: z.string().optional(),
      status: z.enum(['DRAFT', 'IN_REVIEW']).default('DRAFT'),
      tags: z.array(z.string()).default([]),
      category: z.string().optional(),
      goal: z.string().optional(),
      precondition: z.string().optional(),
      postcondition: z.string().optional(),
      mainFlow: z.array(z.string()).default([]),
      alternativeFlows: z.array(z.object({
        id: z.string().optional(),
        branchAt: z.string().optional(),
        steps: z.array(z.string()).default([]),
      })).default([]),
      technicalAppendix: z.record(z.unknown()).default({}),
      originalLanguage: z.enum(['de', 'en']).default('de'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;

    const requirement = await prisma.$transaction(async (tx) => {
      const module = await tx.module.update({
        where: { id: data.moduleId },
        data: { sequenceCounter: { increment: 1 } },
      });

      const created = await tx.requirement.create({
        data: {
          humanReadableId: `MOD-${module.code}-${String(module.sequenceCounter).padStart(4, '0')}`,
          moduleId: data.moduleId,
          title: data.title,
          description: data.description,
          context: data.context,
          acceptanceCriteria: data.acceptanceCriteria,
          category: data.category,
          goal: data.goal,
          precondition: data.precondition,
          postcondition: data.postcondition,
          mainFlow: data.mainFlow as any,
          alternativeFlows: data.alternativeFlows as any,
          technicalAppendix: data.technicalAppendix as any,
          classification: data.classification,
          source: data.source,
          status: data.status,
          originalLanguage: data.originalLanguage,
          authorId: req.user.sub,
        },
      });

      await upsertRequirementTags(tx, created.id, data.tags);
      const version = await createRequirementVersion(tx, { ...created, tags: data.tags }, 'CREATE', req.user.sub);
      await tx.requirement.update({
        where: { id: created.id },
        data: { currentVersionId: version.id },
      });

      return tx.requirement.findUnique({
        where: { id: created.id },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      });
    });

    void audit('requirement', requirement?.id ?? null, 'CREATE', req.user.sub, { title: data.title });
    return { requirement: stripTagObjects(requirement) };
  });

  app.get('/api/requirements/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { lang?: string };

    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        module: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
        frozenBy: { select: { id: true, name: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
        _count: { select: { comments: true } },
        tags: { include: { tag: { select: { name: true } } } },
        reviewerCe: { select: { id: true, name: true } },
        reviewerAscShe: { select: { id: true, name: true } },
      },
    });
    if (!requirement) return reply.status(404).send({ error: 'Requirement not found' });

    const merged = await applyRequirementTranslation(stripTagObjects(requirement), query.lang ?? '');
    return { requirement: merged };
  });

  app.patch('/api/requirements/:id', async (req: FastifyRequest, reply: FastifyReply) => {
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
      tags: z.array(z.string()).optional(),
      category: z.string().optional().nullable(),
      goal: z.string().optional().nullable(),
      precondition: z.string().optional().nullable(),
      postcondition: z.string().optional().nullable(),
      mainFlow: z.array(z.string()).optional(),
      alternativeFlows: z.array(z.object({
        id: z.string().optional(),
        branchAt: z.string().optional(),
        steps: z.array(z.string()).default([]),
      })).optional(),
      technicalAppendix: z.record(z.unknown()).optional().nullable(),
      originalLanguage: z.enum(['de', 'en']).optional(),
      reviewedByCe: z.boolean().optional(),
      reviewedByAscShe: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (!isEditable(current.status)) {
      return reply.status(403).send({ error: 'Requirement is frozen or submitted and cannot be edited directly' });
    }

    const userEmail = req.user.email.toLowerCase();
    const ASC_SHE_ALLOWED = ['alexander.schulz@hup.de', 'simon.heinrich@hup.de'];
    if (data.reviewedByAscShe !== undefined && !ASC_SHE_ALLOWED.includes(userEmail)) {
      return reply.status(403).send({ error: 'Not allowed to set ASC/SHE review' });
    }

    const { editVersion, tags: requestedTags, ...rest } = data;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const fieldUpdate: any = {};
        for (const [key, value] of Object.entries(rest)) {
          if (value !== undefined) fieldUpdate[key] = value;
        }
        if (rest.description === null) fieldUpdate.description = null;
        if (rest.context === null) fieldUpdate.context = null;
        if (rest.goal === null) fieldUpdate.goal = null;
        if (rest.precondition === null) fieldUpdate.precondition = null;
        if (rest.postcondition === null) fieldUpdate.postcondition = null;
        if (rest.technicalAppendix === null) fieldUpdate.technicalAppendix = null;
        if (rest.category === null) fieldUpdate.category = null;

        const updatedCount = await tx.requirement.updateMany({
          where: { id, editVersion },
          data: { ...fieldUpdate, editVersion: { increment: 1 } },
        });

        if (updatedCount.count === 0) {
          throw new Error('Conflict');
        }

        if (requestedTags !== undefined) {
          await upsertRequirementTags(tx, id, requestedTags);
        }

        const requirement = await tx.requirement.findUnique({
          where: { id },
          include: {
            tags: { include: { tag: { select: { name: true } } } },
          },
        });

        if (!requirement) throw new Error('Requirement disappeared');

        const version = await createRequirementVersion(tx, requirement, 'EDIT', req.user.sub);
        await tx.requirement.update({
          where: { id },
          data: { currentVersionId: version.id },
        });

        return tx.requirement.findUnique({
          where: { id },
          include: {
            module: { select: { id: true, name: true, code: true } },
            author: { select: { id: true, name: true } },
            currentVersion: { select: { id: true, versionNumber: true } },
            tags: { include: { tag: { select: { name: true } } } },
          },
        });
      });

      void audit('requirement', id, 'UPDATE', req.user.sub, { editVersion });
      return { requirement: stripTagObjects(updated) };
    } catch (err) {
      if (err instanceof Error && err.message === 'Conflict') {
        return reply.status(409).send({ error: 'Conflict: requirement was modified by someone else' });
      }
      throw err;
    }
  });

  app.post('/api/requirements/:id/edit', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { currentVersion: true, tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });

    if (current.status === 'DRAFT' || current.status === 'IN_REVIEW') {
      return { requirement: stripTagObjects(current) };
    }

    const snapshot = current.currentVersion;
    if (!snapshot) {
      return reply.status(400).send({ error: 'No version to restore' });
    }

    const restored = await prisma.$transaction(async (tx) => {
      const versionData = {
        ...snapshot,
        id,
        moduleId: snapshot.moduleId,
        status: 'DRAFT',
        tags: snapshot.tags ?? [],
      };
      const version = await createRequirementVersion(tx, versionData, 'ROLLBACK', req.user.sub, `Wiedereröffnet aus Version ${snapshot.versionNumber}`);

      const updated = await tx.requirement.update({
        where: { id },
        data: {
          status: 'DRAFT',
          statusComment: null,
          title: snapshot.title,
          description: snapshot.description,
          context: snapshot.context,
          acceptanceCriteria: snapshot.acceptanceCriteria,
          classification: snapshot.classification,
          moduleId: snapshot.moduleId,
          source: snapshot.source,
          category: snapshot.category,
          goal: snapshot.goal,
          precondition: snapshot.precondition,
          postcondition: snapshot.postcondition,
          mainFlow: snapshot.mainFlow as any,
          alternativeFlows: snapshot.alternativeFlows as any,
          technicalAppendix: snapshot.technicalAppendix as any,
          originalLanguage: snapshot.originalLanguage,
          currentVersionId: version.id,
          editVersion: { increment: 1 },
        },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      });

      await upsertRequirementTags(tx, id, snapshot.tags ?? []);
      return updated;
    });

    void audit('requirement', id, 'ROLLBACK', req.user.sub, { previousStatus: current.status });
    return { requirement: stripTagObjects(restored) };
  });

  app.post('/api/requirements/:id/submit', async (req: FastifyRequest, reply: FastifyReply) => {
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
      include: { currentVersion: true, tags: { include: { tag: { select: { name: true } } } } },
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
        const nextState = { ...current, status: 'SUBMITTED_FOR_RELEASE' };
        const version = await createRequirementVersion(tx, nextState, 'SUBMIT', req.user.sub, changeComment);

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

        if (aiCheck.review?.id) {
          await tx.aIReview.updateMany({
            where: { id: aiCheck.review.id },
            data: { requirementId: current.id },
          });
        }

        return tx.requirement.findUnique({
          where: { id },
          include: {
            module: { select: { id: true, name: true, code: true } },
            author: { select: { id: true, name: true } },
            currentVersion: { select: { id: true, versionNumber: true } },
            tags: { include: { tag: { select: { name: true } } } },
          },
        });
      });

      void audit('requirement', id, 'SUBMIT', req.user.sub, { changeComment, aiReviewId });
      return { requirement: stripTagObjects(updated) };
    } catch (err) {
      if (err instanceof Error && err.message === 'Conflict') {
        return reply.status(409).send({ error: 'Conflict: requirement was modified' });
      }
      throw err;
    }
  });

  app.post('/api/requirements/:id/approve', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (current.status !== 'SUBMITTED_FOR_RELEASE') {
      return reply.status(400).send({ error: 'Only submitted requirements can be approved' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextState = { ...current, status: 'APPROVED' };
      const version = await createRequirementVersion(tx, nextState, 'APPROVE', req.user.sub, parsed.data.statusComment);

      const reqUpdated = await tx.requirement.update({
        where: { id },
        data: {
          status: 'APPROVED',
          frozenById: req.user.sub,
          frozenAt: new Date(),
          statusComment: parsed.data.statusComment,
          currentVersionId: version.id,
        },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          frozenBy: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      });
      return reqUpdated;
    });

    void audit('requirement', id, 'APPROVE', req.user.sub, { statusComment: parsed.data.statusComment });
    return { requirement: stripTagObjects(updated) };
  });

  app.post('/api/requirements/:id/reject', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (current.status !== 'SUBMITTED_FOR_RELEASE') {
      return reply.status(400).send({ error: 'Only submitted requirements can be rejected' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextState = { ...current, status: 'REJECTED' };
      const version = await createRequirementVersion(tx, nextState, 'REJECT', req.user.sub, parsed.data.statusComment);

      return tx.requirement.update({
        where: { id },
        data: {
          status: 'REJECTED',
          statusComment: parsed.data.statusComment,
          currentVersionId: version.id,
        },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      });
    });

    void audit('requirement', id, 'REJECT', req.user.sub, { statusComment: parsed.data.statusComment });
    return { requirement: stripTagObjects(updated) };
  });

  app.post('/api/requirements/:id/reopen', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ statusComment: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });
    if (current.status !== 'APPROVED' && current.status !== 'REJECTED' && current.status !== 'POSTPONED') {
      return reply.status(400).send({ error: 'Requirement cannot be reopened' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextState = { ...current, status: 'DRAFT' };
      const version = await createRequirementVersion(tx, nextState, 'REOPEN', req.user.sub, parsed.data.statusComment);

      return tx.requirement.update({
        where: { id },
        data: {
          status: 'DRAFT',
          statusComment: parsed.data.statusComment,
          currentVersionId: version.id,
        },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      });
    });

    void audit('requirement', id, 'REOPEN', req.user.sub, { statusComment: parsed.data.statusComment });
    return { requirement: stripTagObjects(updated) };
  });

  app.post('/api/requirements/:id/rollback', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ versionId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { author: { select: { id: true } }, tags: { include: { tag: { select: { name: true } } } } },
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
      const versionData = {
        ...version,
        id,
        moduleId: version.moduleId,
        status: 'DRAFT',
        tags: version.tags ?? [],
      };
      const newVersion = await createRequirementVersion(tx, versionData, 'ROLLBACK', req.user.sub, `Rollback zu Version ${version.versionNumber}`);

      const reqUpdated = await tx.requirement.update({
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
          category: newVersion.category,
          goal: newVersion.goal,
          precondition: newVersion.precondition,
          postcondition: newVersion.postcondition,
          mainFlow: newVersion.mainFlow as any,
          alternativeFlows: newVersion.alternativeFlows as any,
          technicalAppendix: newVersion.technicalAppendix as any,
          originalLanguage: newVersion.originalLanguage,
          statusComment: null,
          editVersion: { increment: 1 },
        },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      });

      await upsertRequirementTags(tx, id, version.tags ?? []);
      return reqUpdated;
    });

    void audit('requirement', id, 'ROLLBACK', req.user.sub, { versionId: version.id });
    return { requirement: stripTagObjects(updated) };
  });

  app.get('/api/requirements/:id/versions', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      select: { currentVersionId: true },
    });
    if (!requirement) return reply.status(404).send({ error: 'Requirement not found' });

    const versions = await prisma.requirementVersion.findMany({
      where: { requirementId: id },
      orderBy: { versionNumber: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
        aiReview: { select: { id: true, status: true, result: true } },
      },
    });

    return {
      versions: versions.map((v) => ({
        ...v,
        currentVersion: v.id === requirement.currentVersionId,
      })),
    };
  });

  app.post('/api/requirements/:id/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      reviewedByCe: z.boolean().optional(),
      reviewedByAscShe: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { reviewedByCe, reviewedByAscShe } = parsed.data;

    const userEmail = req.user.email.toLowerCase();
    const ASC_SHE_ALLOWED = ['alexander.schulz@hup.de', 'simon.heinrich@hup.de'];

    if (reviewedByAscShe !== undefined && !ASC_SHE_ALLOWED.includes(userEmail)) {
      return reply.status(403).send({ error: 'Not allowed to set ASC/SHE review' });
    }

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });

    const updateData: any = {};
    if (reviewedByCe !== undefined) {
      updateData.reviewedByCe = reviewedByCe;
      updateData.reviewedAtCe = reviewedByCe ? new Date() : null;
      updateData.reviewerCeId = reviewedByCe ? req.user.sub : null;
    }
    if (reviewedByAscShe !== undefined) {
      updateData.reviewedByAscShe = reviewedByAscShe;
      updateData.reviewedAtAscShe = reviewedByAscShe ? new Date() : null;
      updateData.reviewerAscSheId = reviewedByAscShe ? req.user.sub : null;
    }

    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({ error: 'No review fields provided' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.requirement.update({
        where: { id },
        data: { ...updateData, editVersion: { increment: 1 } },
      });

      const requirement = await tx.requirement.findUnique({
        where: { id },
        include: {
          tags: { include: { tag: { select: { name: true } } } },
        },
      });
      if (!requirement) throw new Error('Requirement disappeared');

      const version = await createRequirementVersion(tx, requirement, 'REVIEW', req.user.sub);
      await tx.requirement.update({
        where: { id },
        data: { currentVersionId: version.id },
      });

      return tx.requirement.findUnique({
        where: { id },
        include: {
          module: { select: { id: true, name: true, code: true } },
          author: { select: { id: true, name: true } },
          currentVersion: { select: { id: true, versionNumber: true } },
          tags: { include: { tag: { select: { name: true } } } },
          reviewerCe: { select: { id: true, name: true } },
          reviewerAscShe: { select: { id: true, name: true } },
        },
      });
    });

    if (reviewedByCe !== undefined) {
      void audit('requirement', id, 'REVIEW_CE', req.user.sub, { oldValue: current.reviewedByCe, newValue: reviewedByCe });
    }
    if (reviewedByAscShe !== undefined) {
      void audit('requirement', id, 'REVIEW_ASC_SHE', req.user.sub, { oldValue: current.reviewedByAscShe, newValue: reviewedByAscShe });
    }

    return { requirement: stripTagObjects(updated) };
  });

  app.post('/api/requirements/:id/jira-ticket', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user.isAdmin) {
      return reply.status(403).send({ error: 'Admin permission required' });
    }

    const { id } = req.params as { id: string };
    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });

    if (!current.reviewedByAscShe) {
      return reply.status(403).send({ error: 'ASC/SHE review is required before creating a Jira ticket' });
    }

    if (current.jiraIssueKey) {
      return reply.status(409).send({ error: 'Jira ticket already exists' });
    }

    const env = getEnv();
    const reachReqUrl = `${env.FRONTEND_URL}/requirements/${id}`;

    try {
      const { key, url } = await createJiraIssue({
        summary: current.title,
        description: buildUseCaseDescription({
          title: current.title,
          goal: current.goal,
          precondition: current.precondition,
          mainFlow: current.mainFlow,
          postcondition: current.postcondition,
          reachReqUrl,
        }),
      });

      const updated = await prisma.$transaction(async (tx) => {
        const jiraIssueCreatedAt = new Date();
        const updatedReq = await tx.requirement.update({
          where: { id },
          data: {
            jiraIssueKey: key,
            jiraIssueUrl: url,
            jiraIssueCreatedAt,
          },
          include: {
            tags: { include: { tag: { select: { name: true } } } },
          },
        });

        const version = await createRequirementVersion(tx, { ...updatedReq, jiraIssueKey: key, jiraIssueUrl: url, jiraIssueCreatedAt }, 'JIRA_CREATED', req.user.sub, `Jira-Ticket ${key} erstellt`);
        await tx.requirement.update({
          where: { id },
          data: { currentVersionId: version.id },
        });

        return tx.requirement.findUnique({
          where: { id },
          include: {
            module: { select: { id: true, name: true, code: true } },
            author: { select: { id: true, name: true } },
            currentVersion: { select: { id: true, versionNumber: true } },
            tags: { include: { tag: { select: { name: true } } } },
          },
        });
      });

      void audit('requirement', id, 'JIRA_CREATED', req.user.sub, { issueKey: key });
      return { requirement: stripTagObjects(updated), jiraIssueKey: key, jiraIssueUrl: url };
    } catch (err) {
      app.log.error(err, 'Jira ticket creation failed');
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Jira ticket creation failed' });
    }
  });

  app.post('/api/requirements/:id/translate', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ targetLanguage: z.enum(['de', 'en']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { targetLanguage } = parsed.data;

    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!requirement) return reply.status(404).send({ error: 'Requirement not found' });

    if (targetLanguage === requirement.originalLanguage) {
      return reply.status(400).send({ error: 'Target language equals original language' });
    }

    const payload = await buildUseCasePayload(requirement);
    const translation: UseCaseTranslation = await translateUseCase(payload, targetLanguage);

    const stored = await prisma.translation.upsert({
      where: { requirementId_language: { requirementId: id, language: targetLanguage } },
      create: {
        requirementId: id,
        language: targetLanguage,
        title: translation.title,
        description: translation.description,
        context: translation.context,
        acceptanceCriteria: translation.acceptanceCriteria ?? [],
        goal: translation.goal,
        precondition: translation.precondition,
        postcondition: translation.postcondition,
        mainFlow: translation.mainFlow as any,
        alternativeFlows: translation.alternativeFlows as any,
        technicalAppendix: translation.technicalAppendix as any,
      },
      update: {
        title: translation.title,
        description: translation.description,
        context: translation.context,
        acceptanceCriteria: translation.acceptanceCriteria ?? [],
        goal: translation.goal,
        precondition: translation.precondition,
        postcondition: translation.postcondition,
        mainFlow: translation.mainFlow as any,
        alternativeFlows: translation.alternativeFlows as any,
        technicalAppendix: translation.technicalAppendix as any,
      },
    });

    return { translation: stored };
  });

  app.post('/api/requirements/:id/ai-review', async (req: FastifyRequest, reply: FastifyReply) => {
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

  app.get('/api/requirements/:id/ai-reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const reviews = await prisma.aIReview.findMany({
      where: { requirementId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { aiReviews: reviews };
  });

  app.get('/api/requirements/:id/links', async (req: FastifyRequest, reply: FastifyReply) => {
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

  app.post('/api/requirements/:id/links', async (req: FastifyRequest, reply: FastifyReply) => {
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

  app.delete('/api/requirements/:id/links/:linkId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { linkId } = req.params as { linkId: string };
    const link = await prisma.requirementLink.findUnique({ where: { id: linkId } });
    if (!link) return reply.status(404).send({ error: 'Link not found' });

    await prisma.requirementLink.delete({ where: { id: linkId } });
    void audit('requirement_link', linkId, 'DELETE', req.user.sub, {});
    return { success: true };
  });

  app.get('/api/requirements/:id/glossary-links', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const links = await prisma.requirementGlossaryLink.findMany({
      where: { requirementId: id },
      include: { glossaryEntry: { select: { id: true, term: true, status: true } } },
    });
    return { links: links.map((l) => l.glossaryEntry) };
  });

  app.post('/api/requirements/:id/glossary-links', async (req: FastifyRequest, reply: FastifyReply) => {
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
