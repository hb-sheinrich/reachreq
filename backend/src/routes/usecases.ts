import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';
import { upsertRequirementTags } from '../services/tags.js';
import { createRequirementVersion } from '../services/versions.js';
import { translateUseCase, type UseCase, type UseCaseTranslation } from '../services/translation.js';
import { buildRequirementWhere } from './requirements.js';

const alternativeFlowSchema = z.object({
  id: z.string().optional(),
  branchAt: z.string().optional(),
  steps: z.array(z.string()).default([]),
});

export const useCaseSchema = z.object({
  id: z.string().optional().or(z.literal('')).optional(),
  category: z.string().optional(),
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
  goal: z.string().optional(),
  precondition: z.string().optional(),
  mainFlow: z.array(z.string()).default([]),
  alternativeFlows: z.array(alternativeFlowSchema).default([]),
  postcondition: z.string().optional(),
  technicalAppendix: z.record(z.unknown()).default({}),
});

export type UseCaseInput = z.infer<typeof useCaseSchema>;

function mapUseCaseToRequirementFields(uc: UseCaseInput) {
  return {
    useCaseId: uc.id || null,
    category: uc.category,
    title: uc.title,
    goal: uc.goal,
    precondition: uc.precondition,
    postcondition: uc.postcondition,
    mainFlow: uc.mainFlow,
    alternativeFlows: uc.alternativeFlows,
    technicalAppendix: uc.technicalAppendix,
    tags: uc.tags,
  };
}

export function mapRequirementToUseCase(requirement: any): UseCase {
  const tagNames = Array.isArray(requirement.tags)
    ? requirement.tags.map((t: any) => (typeof t === 'string' ? t : t?.tag?.name)).filter(Boolean)
    : [];

  return {
    id: requirement.useCaseId ?? undefined,
    category: requirement.category ?? undefined,
    title: requirement.title,
    tags: tagNames,
    goal: requirement.goal ?? undefined,
    precondition: requirement.precondition ?? undefined,
    mainFlow: (requirement.mainFlow as string[]) ?? undefined,
    alternativeFlows: (requirement.alternativeFlows as { id?: string; branchAt?: string; steps: string[] }[]) ?? undefined,
    postcondition: requirement.postcondition ?? undefined,
    technicalAppendix: (requirement.technicalAppendix as Record<string, unknown>) ?? undefined,
  };
}

async function createRequirementFromUseCase(
  tx: any,
  uc: UseCaseInput,
  moduleId: string,
  defaults: { classification?: string; status?: string; originalLanguage?: string },
  authorId: string
) {
  const module = await tx.module.update({
    where: { id: moduleId },
    data: { sequenceCounter: { increment: 1 } },
  });

  const fields = mapUseCaseToRequirementFields(uc);
  const requirement = await tx.requirement.create({
    data: {
      humanReadableId: `MOD-${module.code}-${String(module.sequenceCounter).padStart(4, '0')}`,
      moduleId,
      title: fields.title,
      description: undefined,
      context: undefined,
      acceptanceCriteria: [],
      useCaseId: fields.useCaseId,
      category: fields.category,
      goal: fields.goal,
      precondition: fields.precondition,
      postcondition: fields.postcondition,
      mainFlow: fields.mainFlow,
      alternativeFlows: fields.alternativeFlows,
      technicalAppendix: fields.technicalAppendix as any,
      classification: (defaults.classification as any) ?? 'MUST_HAVE',
      status: (defaults.status as any) ?? 'DRAFT',
      source: undefined,
      originalLanguage: defaults.originalLanguage ?? 'de',
      authorId,
    },
  });

  await upsertRequirementTags(tx, requirement.id, fields.tags);
  const version = await createRequirementVersion(tx, requirement, 'CREATE', authorId, 'Import aus Use-Case 2.0');
  await tx.requirement.update({
    where: { id: requirement.id },
    data: { currentVersionId: version.id },
  });

  return { ...requirement, currentVersionId: version.id };
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

export async function usecaseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/export/usecases.json', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as Record<string, string | undefined>;
    const where = buildRequirementWhere(query);

    const requirements = await prisma.requirement.findMany({
      where,
      orderBy: { humanReadableId: 'asc' },
      include: {
        module: { select: { name: true, code: true } },
        tags: { include: { tag: { select: { name: true } } } },
      },
    });

    const useCases = requirements.map((r) => mapRequirementToUseCase(r));

    void audit('export', null, 'EXPORT', req.user?.sub ?? null, { format: 'usecases.json', count: useCases.length });

    return reply.type('application/json').send(useCases);
  });

  app.get('/api/export/usecases/:id.json', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        module: { select: { name: true, code: true } },
        tags: { include: { tag: { select: { name: true } } } },
      },
    });
    if (!requirement) return reply.status(404).send({ error: 'Requirement not found' });

    return reply.type('application/json').send(mapRequirementToUseCase(requirement));
  });

  app.post('/api/import/usecases', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user.isAdmin) return reply.status(403).send({ error: 'Admin required' });

    const schema = z.object({
      moduleId: z.string(),
      classification: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE', 'WONT_HAVE']).optional(),
      status: z.enum(['DRAFT', 'IN_REVIEW']).optional(),
      targetLanguage: z.enum(['de', 'en']).optional(),
      useCases: z.array(useCaseSchema),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { moduleId, classification, status, targetLanguage, useCases: ucs } = parsed.data;

    const originalLanguage = targetLanguage === 'en' ? 'de' : 'de';

    const created = await prisma.$transaction(async (tx) => {
      const requirements: any[] = [];
      for (const uc of ucs) {
        const requirement = await createRequirementFromUseCase(tx, uc, moduleId, { classification, status, originalLanguage }, req.user.sub);

        if (targetLanguage && targetLanguage !== originalLanguage) {
          const payload = await buildUseCasePayload(requirement);
          const translation: UseCaseTranslation = await translateUseCase(payload, targetLanguage);
          await tx.translation.create({
            data: {
              requirementId: requirement.id,
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
          });
        }

        requirements.push(requirement);
      }
      return requirements;
    });

    void audit('import', null, 'IMPORT', req.user.sub, { count: created.length, format: 'usecases.json' });
    return { created: created.length };
  });

  app.post('/api/requirements/:id/usecase/import', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const schema = z.intersection(
      useCaseSchema,
      z.object({
        classification: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE', 'WONT_HAVE']).optional(),
        status: z.enum(['DRAFT', 'IN_REVIEW']).optional(),
        targetLanguage: z.enum(['de', 'en']).optional(),
      })
    );

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;

    const current = await prisma.requirement.findUnique({
      where: { id },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!current) return reply.status(404).send({ error: 'Requirement not found' });

    const fields = mapUseCaseToRequirementFields(data);
    const originalLanguage = current.originalLanguage ?? 'de';

    const updated = await prisma.$transaction(async (tx) => {
      const updateData = {
        title: fields.title,
        useCaseId: fields.useCaseId,
        category: fields.category,
        goal: fields.goal,
        precondition: fields.precondition,
        postcondition: fields.postcondition,
        mainFlow: fields.mainFlow,
        alternativeFlows: fields.alternativeFlows,
        technicalAppendix: fields.technicalAppendix as any,
        classification: (data.classification as any) ?? current.classification,
        status: (data.status as any) ?? current.status,
        originalLanguage,
      };

      await tx.requirement.update({
        where: { id },
        data: updateData,
      });

      await upsertRequirementTags(tx, id, fields.tags);

      const requirement = await tx.requirement.findUnique({
        where: { id },
        include: {
          module: { select: { id: true, name: true, code: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      });

      if (!requirement) throw new Error('Requirement disappeared');

      const version = await createRequirementVersion(tx, requirement, 'EDIT', req.user.sub, 'Use-Case 2.0 Import');
      await tx.requirement.update({
        where: { id },
        data: { currentVersionId: version.id, editVersion: { increment: 1 } },
      });

      if (data.targetLanguage && data.targetLanguage !== originalLanguage) {
        const payload = await buildUseCasePayload(requirement);
        const translation: UseCaseTranslation = await translateUseCase(payload, data.targetLanguage);
        await tx.translation.upsert({
          where: { requirementId_language: { requirementId: id, language: data.targetLanguage } },
          create: {
            requirementId: id,
            language: data.targetLanguage,
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

    void audit('requirement', id, 'UPDATE', req.user.sub, { action: 'usecase_import' });
    return { requirement: updated };
  });
}
