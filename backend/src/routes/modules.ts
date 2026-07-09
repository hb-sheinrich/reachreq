import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';

function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user.isAdmin) {
    reply.status(403).send({ error: 'Admin permission required' });
    return false;
  }
  return true;
}

async function updateModulePath(tx: any, moduleId: string) {
  const module = await tx.module.findUnique({
    where: { id: moduleId },
    include: { parent: true },
  });
  if (!module) return;

  const path = module.parent ? `${module.parent.path || module.parent.id}/${module.id}` : module.id;
  await tx.module.update({ where: { id: moduleId }, data: { path } });

  const children = await tx.module.findMany({ where: { parentId: moduleId } });
  for (const child of children) {
    await updateModulePath(tx, child.id);
  }
}

export async function moduleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/modules', async (_req, reply) => {
    const modules = await prisma.module.findMany({
      orderBy: [{ path: 'asc' }, { sortOrder: 'asc' }],
    });
    return { modules };
  });

  app.get('/api/modules/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const module = await prisma.module.findUnique({ where: { id } });
    if (!module) return reply.status(404).send({ error: 'Module not found' });
    return { module };
  });

  app.post('/api/modules', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const schema = z.object({
      name: z.string().min(1),
      code: z.string().min(1).max(10),
      description: z.string().optional(),
      parentId: z.string().optional().nullable(),
      sortOrder: z.number().default(0),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
    const existing = await prisma.module.findUnique({ where: { code: data.code } });
    if (existing) return reply.status(409).send({ error: 'Module code already exists' });

    const created = await prisma.$transaction(async (tx) => {
      const module = await tx.module.create({
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          parentId: data.parentId,
          sortOrder: data.sortOrder,
        },
      });
      await updateModulePath(tx, module.id);
      return tx.module.findUnique({ where: { id: module.id } });
    });

    void audit('module', created?.id ?? null, 'CREATE', req.user.sub, { name: data.name, code: data.code });
    return { module: created };
  });

  app.patch('/api/modules/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({
      name: z.string().min(1).optional(),
      code: z.string().min(1).max(10).optional(),
      description: z.string().optional().nullable(),
      parentId: z.string().optional().nullable(),
      sortOrder: z.number().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
    const current = await prisma.module.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Module not found' });

    if (data.parentId && data.parentId === id) {
      return reply.status(400).send({ error: 'A module cannot be its own parent' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const module = await tx.module.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          parentId: data.parentId,
          sortOrder: data.sortOrder,
        },
      });
      await updateModulePath(tx, module.id);
      return tx.module.findUnique({ where: { id: module.id } });
    });

    void audit('module', id, 'UPDATE', req.user.sub, data);
    return { module: updated };
  });

  app.delete('/api/modules/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const module = await prisma.module.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!module) return reply.status(404).send({ error: 'Module not found' });

    if (module.children.length > 0) {
      return reply.status(400).send({ error: 'Module has sub-modules. Move or delete them first.' });
    }

    const fallbackRootId = module.parentId
      ?? (await prisma.module.findFirst({
        where: { parentId: null, id: { not: id } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }))?.id;

    if (!fallbackRootId) {
      return reply.status(400).send({ error: 'Cannot delete root module without another root module to move contents to' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.requirement.updateMany({
        where: { moduleId: id },
        data: { moduleId: fallbackRootId },
      });
      await tx.glossaryEntry.updateMany({
        where: { moduleId: id },
        data: { moduleId: module.parentId },
      });
      await tx.module.delete({ where: { id } });
    });

    void audit('module', id, 'DELETE', req.user.sub, { name: module.name });
    return { success: true };
  });

  app.post('/api/modules/:id/move', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({
      parentId: z.string().optional().nullable(),
      sortOrder: z.number().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
    const updated = await prisma.$transaction(async (tx) => {
      const module = await tx.module.update({
        where: { id },
        data: { parentId: data.parentId, sortOrder: data.sortOrder },
      });
      await updateModulePath(tx, module.id);
      return tx.module.findUnique({ where: { id: module.id } });
    });

    void audit('module', id, 'MOVE', req.user.sub, data);
    return { module: updated };
  });

  app.post('/api/modules/:id/merge', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const { id } = req.params as { id: string };
    const schema = z.object({ targetModuleId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { targetModuleId } = parsed.data;
    if (id === targetModuleId) return reply.status(400).send({ error: 'Cannot merge into itself' });

    const [source, target] = await Promise.all([
      prisma.module.findUnique({ where: { id }, include: { children: true } }),
      prisma.module.findUnique({ where: { id: targetModuleId } }),
    ]);
    if (!source || !target) return reply.status(404).send({ error: 'Module not found' });

    await prisma.$transaction(async (tx) => {
      await tx.requirement.updateMany({ where: { moduleId: id }, data: { moduleId: targetModuleId } });
      await tx.glossaryEntry.updateMany({ where: { moduleId: id }, data: { moduleId: targetModuleId } });
      await tx.module.updateMany({ where: { parentId: id }, data: { parentId: targetModuleId } });
      for (const child of source.children) {
        await updateModulePath(tx, child.id);
      }
      await tx.module.delete({ where: { id } });
    });

    void audit('module', id, 'MERGE', req.user.sub, { targetModuleId });
    return { success: true };
  });
}
