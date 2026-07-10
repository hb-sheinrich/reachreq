import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../services/audit.js';
import { buildRequirementWhere } from './requirements.js';
import ExcelJS from 'exceljs';

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value).replace(/"/g, '""');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str}"`;
  }
  return str;
}

async function getRequirementsForExport(query: Record<string, string | undefined>) {
  const where = buildRequirementWhere(query);

  return prisma.requirement.findMany({
    where,
    include: {
      module: { select: { name: true } },
      author: { select: { name: true, email: true } },
      currentVersion: { select: { versionNumber: true } },
    },
    orderBy: { humanReadableId: 'asc' },
  });
}

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/export/requirements.csv', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const requirements = await getRequirementsForExport(query);
    const header = ['ID', 'Titel', 'Modul', 'Klassifizierung', 'Status', 'Quelle', 'Autor', 'Erstellt am', 'Beschreibung', 'Akzeptanzkriterien'];
    const rows = requirements.map((r) => [
      r.humanReadableId,
      r.title,
      r.module?.name ?? '',
      r.classification,
      r.status,
      r.source ?? '',
      r.author?.name ?? '',
      r.createdAt.toISOString(),
      r.description ?? '',
      (r.acceptanceCriteria ?? []).join('\\n'),
    ]);
    const csv = [header.map(escapeCsv).join(';'), ...rows.map((row) => row.map(escapeCsv).join(';'))].join('\\n');

    void audit('export', null, 'EXPORT', req.user?.sub ?? null, { format: 'csv', count: requirements.length });

    return reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="requirements.csv"').send(csv);
  });

  app.get('/api/export/requirements.xlsx', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const requirements = await getRequirementsForExport(query);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Anforderungen');
    sheet.columns = [
      { header: 'ID', key: 'id' },
      { header: 'Titel', key: 'title' },
      { header: 'Modul', key: 'module' },
      { header: 'Klassifizierung', key: 'classification' },
      { header: 'Status', key: 'status' },
      { header: 'Quelle', key: 'source' },
      { header: 'Autor', key: 'author' },
      { header: 'Erstellt am', key: 'createdAt' },
      { header: 'Beschreibung', key: 'description' },
      { header: 'Akzeptanzkriterien', key: 'acceptanceCriteria' },
    ];
    for (const r of requirements) {
      sheet.addRow({
        id: r.humanReadableId,
        title: r.title,
        module: r.module?.name ?? '',
        classification: r.classification,
        status: r.status,
        source: r.source ?? '',
        author: r.author?.name ?? '',
        createdAt: r.createdAt.toISOString(),
        description: r.description ?? '',
        acceptanceCriteria: (r.acceptanceCriteria ?? []).join('\\n'),
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();

    void audit('export', null, 'EXPORT', req.user?.sub ?? null, { format: 'xlsx', count: requirements.length });

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="requirements.xlsx"')
      .send(buffer);
  });

  app.post('/api/import/requirements', async (req, reply) => {
    if (!req.user.isAdmin) return reply.status(403).send({ error: 'Admin required' });

    const schema = z.array(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      context: z.string().optional(),
      acceptanceCriteria: z.array(z.string()).optional(),
      classification: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE', 'WONT_HAVE']).optional(),
      source: z.string().optional(),
      moduleId: z.string().optional(),
      humanReadableId: z.string().optional(),
    }));

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const rows = parsed.data;
    const created = [];
    for (const row of rows) {
      const moduleId = row.moduleId;
      let humanReadableId = row.humanReadableId;
      if (moduleId && !humanReadableId) {
        const module = await prisma.module.update({
          where: { id: moduleId },
          data: { sequenceCounter: { increment: 1 } },
        });
        humanReadableId = `MOD-${module.code}-${String(module.sequenceCounter).padStart(4, '0')}`;
      }
      const requirement = await prisma.requirement.create({
        data: {
          humanReadableId: humanReadableId ?? 'UNKNOWN',
          moduleId: moduleId ?? (await prisma.module.findFirst({ orderBy: { createdAt: 'asc' } }))?.id ?? '',
          title: row.title,
          description: row.description,
          context: row.context,
          acceptanceCriteria: row.acceptanceCriteria ?? [],
          classification: row.classification ?? 'MUST_HAVE',
          source: row.source,
          authorId: req.user.sub,
        },
      });
      created.push(requirement);
    }

    void audit('import', null, 'IMPORT', req.user.sub, { count: created.length });
    return { created: created.length };
  });
}
