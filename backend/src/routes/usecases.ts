import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';
import { requireWrite, requireAdmin } from '../lib/auth.js';
import { upsertRequirementTags } from '../services/tags.js';
import { createRequirementVersion } from '../services/versions.js';
import { type UseCase } from '../services/translation.js';
import { buildRequirementWhere } from './requirements.js';

function isEditable(status: string) {
  return status === 'DRAFT' || status === 'IN_REVIEW' || status === 'IMPORTED';
}

function extractTagNames(requirement: any): string[] {
  return Array.isArray(requirement.tags)
    ? requirement.tags.map((t: any) => (typeof t === 'string' ? t : t?.tag?.name)).filter(Boolean)
    : [];
}

const alternativeFlowSchema = z.object({
  title: z.string().optional(),
  afterStep: z.union([z.string(), z.number()]).optional(),
  branchAt: z.union([z.string(), z.number()]).optional(),
  steps: z.array(z.string()).default([]),
});

export const useCaseSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()).default([]),
  goal: z.string().optional(),
  precondition: z.string().optional(),
  mainFlow: z.array(z.string()).default([]),
  alternativeFlows: z.array(alternativeFlowSchema).default([]),
  postcondition: z.string().optional(),
  technicalAppendix: z.record(z.unknown()).default({}),
});

export type UseCaseInput = z.infer<typeof useCaseSchema>;

function validateUseCase(uc: unknown, index: number): { ok: true } | { ok: false; errors: string[] } {
  if (!uc || typeof uc !== 'object') {
    return { ok: false, errors: [`Use-Case ${index + 1} ist kein Objekt`] };
  }
  const data = uc as Record<string, unknown>;
  const errors: string[] = [];

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Titel');
  }
  if (!data.goal || typeof data.goal !== 'string' || data.goal.trim().length === 0) {
    errors.push('Ziel');
  }
  if (!Array.isArray(data.mainFlow) || data.mainFlow.length === 0) {
    errors.push('Basisablauf');
  } else {
    for (const [i, step] of (data.mainFlow as unknown[]).entries()) {
      if (typeof step !== 'string' || step.trim().length === 0) {
        errors.push(`Basisablauf Schritt ${i + 1} ist leer`);
      }
    }
  }
  if (!data.postcondition || typeof data.postcondition !== 'string' || data.postcondition.trim().length === 0) {
    errors.push('Nachbedingung');
  }

  if (data.alternativeFlows && Array.isArray(data.alternativeFlows)) {
    for (const [i, flow] of (data.alternativeFlows as unknown[]).entries()) {
      if (!flow || typeof flow !== 'object') {
        errors.push(`Alternativer Ablauf ${i + 1} ist ungültig`);
        continue;
      }
      const flowData = flow as Record<string, unknown>;
      if (!Array.isArray(flowData.steps) || flowData.steps.length === 0) {
        errors.push(`Alternativer Ablauf ${i + 1} hat keine Schritte`);
      } else {
        for (const [j, step] of (flowData.steps as unknown[]).entries()) {
          if (typeof step !== 'string' || step.trim().length === 0) {
            errors.push(`Alternativer Ablauf ${i + 1}, Schritt ${j + 1} ist leer`);
          }
        }
      }
    }
  }

  if (data.technicalAppendix && typeof data.technicalAppendix !== 'object') {
    errors.push('Technischer Anhang muss ein Objekt sein');
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function mapLanguage(lang: string): 'de' | 'en' {
  const normalized = lang.trim().toLowerCase();
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('en')) return 'en';
  throw new Error(`Unbekannte Sprache in Metadaten: ${lang}. Unterstützt werden DE und EN.`);
}

function mapUseCaseToRequirementFields(uc: UseCaseInput) {
  return {
    title: uc.title,
    goal: uc.goal,
    precondition: uc.precondition,
    postcondition: uc.postcondition,
    mainFlow: uc.mainFlow,
    alternativeFlows: uc.alternativeFlows.map((flow, idx) => ({
      id: `A${idx + 1}`,
      title: flow.title || `A${idx + 1}`,
      afterStep: flow.afterStep ?? flow.branchAt ?? null,
      steps: flow.steps,
    })),
    technicalAppendix: uc.technicalAppendix,
    tags: uc.tags,
  };
}

export function mapRequirementToUseCase(requirement: any): UseCase {
  const tagNames = extractTagNames(requirement);

  const altFlows = (requirement.alternativeFlows as any[] | null)?.map((flow) => {
    const out: Record<string, unknown> = {
      title: flow.title || flow.id || '',
      steps: flow.steps,
    };
    const branch = flow.afterStep ?? flow.branchAt;
    if (branch != null && branch !== '') {
      out.afterStep = branch;
    }
    return out;
  });

  return {
    title: requirement.title,
    tags: tagNames,
    goal: requirement.goal ?? undefined,
    precondition: requirement.precondition ?? undefined,
    mainFlow: (requirement.mainFlow as string[]) ?? undefined,
    alternativeFlows: altFlows ?? undefined,
    postcondition: requirement.postcondition ?? undefined,
    technicalAppendix: (requirement.technicalAppendix as Record<string, unknown>) ?? undefined,
  };
}

function exportUseCaseFile(requirement: any) {
  const originTags = requirement.source
    ? String(requirement.source)
        .split(', ')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return {
    language: (requirement.originalLanguage || 'de').toUpperCase(),
    originTags,
    useCases: [mapRequirementToUseCase(requirement)],
  };
}

function exportUseCasesFile(requirements: any[]) {
  const language = requirements[0]?.originalLanguage?.toUpperCase() || 'DE';
  const originTags = [
    ...new Set(
      requirements.flatMap((r) =>
        r.source
          ? String(r.source)
              .split(', ')
              .map((s) => s.trim())
              .filter(Boolean)
          : []
      )
    ),
  ];
  return {
    language,
    originTags,
    useCases: requirements.map((r) => mapRequirementToUseCase(r)),
  };
}

async function ensureTagIds(names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const existing = await prisma.tag.findMany({
    where: { name: { in: unique } },
    select: { id: true, name: true },
  });
  const map = new Map(existing.map((t) => [t.name, t.id]));
  const missing = unique.filter((n) => !map.has(n));
  if (missing.length) {
    await prisma.tag.createMany({ data: missing.map((name) => ({ name })), skipDuplicates: true });
    const created = await prisma.tag.findMany({
      where: { name: { in: missing } },
      select: { id: true, name: true },
    });
    for (const t of created) map.set(t.name, t.id);
  }
  return map;
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

    const file = exportUseCasesFile(requirements);

    void audit('export', null, 'EXPORT', req.user?.sub ?? null, { format: 'usecases.json', count: file.useCases.length });

    return reply.type('application/json').send(file);
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

    return reply.type('application/json').send(exportUseCaseFile(requirement));
  });

  app.post('/api/import/usecases', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(req, reply)) return;

    const schema = z.object({
      moduleId: z.string(),
      file: z.object({
        language: z.string().min(1),
        originTags: z.array(z.string()).default([]),
        useCases: z.array(useCaseSchema),
      }),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { moduleId, file } = parsed.data;

    const moduleExists = await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } });
    if (!moduleExists) return reply.status(400).send({ error: 'Module not found' });

    const errors: string[] = [];
    for (const [index, uc] of file.useCases.entries()) {
      const validation = validateUseCase(uc, index);
      if (!validation.ok) {
        errors.push(`Use-Case ${index + 1} (${uc.title || 'ohne Titel'}): ${validation.errors.join(', ')}`);
      }
    }
    if (errors.length) {
      return reply.status(400).send({ error: 'Import fehlgeschlagen: ' + errors.join('; ') });
    }

    let originalLanguage: 'de' | 'en';
    try {
      originalLanguage = mapLanguage(file.language);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }

    const originTags = file.originTags.map((t) => t.trim()).filter(Boolean);
    const source = originTags.length ? originTags.join(', ') : undefined;

    const allTagNames: string[] = [...originTags];
    for (const uc of file.useCases) {
      if (Array.isArray(uc.tags)) allTagNames.push(...uc.tags);
    }
    const tagMap = await ensureTagIds(allTagNames);

    const created = await prisma.$transaction(
      async (tx) => {
        const module = await tx.module.update({
          where: { id: moduleId },
          data: { sequenceCounter: { increment: file.useCases.length } },
        });

        const start = module.sequenceCounter - file.useCases.length + 1;
        const requirementData = file.useCases.map((uc, i) => {
          const fields = mapUseCaseToRequirementFields(uc);
          const tags = [...new Set([...fields.tags, ...originTags])];
          return {
            fields,
            tags,
            humanReadableId: `MOD-${module.code}-${String(start + i).padStart(4, '0')}`,
          };
        });

        const newRequirements = await tx.requirement.createManyAndReturn({
          data: requirementData.map(({ fields, humanReadableId }) => ({
            humanReadableId,
            moduleId,
            title: fields.title,
            goal: fields.goal,
            precondition: fields.precondition,
            postcondition: fields.postcondition,
            mainFlow: fields.mainFlow,
            alternativeFlows: fields.alternativeFlows,
            technicalAppendix: fields.technicalAppendix as any,
            classification: 'IMPORTED' as any,
            status: 'IMPORTED' as any,
            source,
            originalLanguage,
            authorId: req.user.sub,
          })),
        });

        const versionData = newRequirements.map((r, i) => {
          const { fields, tags } = requirementData[i];
          return {
            requirementId: r.id,
            versionNumber: 1,
            changeType: 'CREATE',
            changeComment: 'Import aus Use-Case 2.0',
            title: fields.title,
            goal: fields.goal,
            precondition: fields.precondition,
            postcondition: fields.postcondition,
            mainFlow: fields.mainFlow,
            alternativeFlows: fields.alternativeFlows,
            technicalAppendix: fields.technicalAppendix as any,
            classification: 'IMPORTED' as any,
            status: 'IMPORTED' as any,
            source,
            originalLanguage,
            moduleId,
            authorId: r.authorId,
            tags,
            diff: null as any,
            reviewedByCe: false,
            reviewedByAscShe: false,
          };
        });

        const newVersions = await tx.requirementVersion.createManyAndReturn({ data: versionData });

        const requirementTagData: { requirementId: string; tagId: string }[] = [];
        for (let i = 0; i < newRequirements.length; i++) {
          const reqRecord = newRequirements[i];
          const { tags } = requirementData[i];
          for (const tagName of tags) {
            const tagId = tagMap.get(tagName);
            if (tagId) requirementTagData.push({ requirementId: reqRecord.id, tagId });
          }
        }
        if (requirementTagData.length) {
          await tx.requirementTag.createMany({ data: requirementTagData, skipDuplicates: true });
        }

        const versionIds = newVersions.map((v) => v.id);
        const requirementIds = newRequirements.map((r) => r.id);
        await tx.$executeRaw`
          UPDATE requirements r
          SET current_version_id = v.id
          FROM requirement_versions v
          WHERE r.id = v.requirement_id
            AND v.id IN (${Prisma.join(versionIds)})
            AND r.id IN (${Prisma.join(requirementIds)})
        `;

        return newRequirements;
      },
      { timeout: 120000 }
    );

    void audit('import', null, 'IMPORT', req.user.sub, { count: created.length, format: 'usecases.json' });
    return { created: created.length };
  });

  app.post('/api/requirements/:id/usecase/import', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireWrite(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = useCaseSchema.extend({
      editVersion: z.number(),
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
      return reply.status(403).send({ error: 'Requirement is not in an editable state' });
    }

    const fields = mapUseCaseToRequirementFields(data);

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const updateData = {
          title: fields.title,
          goal: fields.goal,
          precondition: fields.precondition,
          postcondition: fields.postcondition,
          mainFlow: fields.mainFlow,
          alternativeFlows: fields.alternativeFlows,
          technicalAppendix: fields.technicalAppendix as any,
          status: current.status === 'IMPORTED' ? 'DRAFT' : current.status,
          originalLanguage: current.originalLanguage ?? 'de',
        };

        const updatedCount = await tx.requirement.updateMany({
          where: { id, editVersion: data.editVersion },
          data: { ...updateData, editVersion: { increment: 1 } },
        });
        if (updatedCount.count === 0) {
          throw new Error('Conflict');
        }

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
    } catch (err) {
      if (err instanceof Error && err.message === 'Conflict') {
        return reply.status(409).send({ error: 'Conflict: requirement was modified by someone else' });
      }
      throw err;
    }

    void audit('requirement', id, 'UPDATE', req.user.sub, { action: 'usecase_import' });
    return { requirement: updated };
  });
}
