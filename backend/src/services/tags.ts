import { prisma } from '../lib/prisma.js';

export async function findTagSuggestions(search: string, limit = 10) {
  return prisma.tag.findMany({
    where: { name: { contains: search, mode: 'insensitive' } },
    take: limit,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, color: true },
  });
}

export function normalizeTagNames(tagNames: string[]): string[] {
  return [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];
}

export async function upsertRequirementTags(
  tx: any,
  requirementId: string,
  tagNames: string[]
): Promise<string[]> {
  const normalized = normalizeTagNames(tagNames);

  if (normalized.length === 0) {
    await tx.requirementTag.deleteMany({ where: { requirementId } });
    return [];
  }

  const tagIds: string[] = [];
  for (const name of normalized) {
    const tag = await tx.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    tagIds.push(tag.id);
  }

  await tx.requirementTag.deleteMany({
    where: { requirementId, tagId: { notIn: tagIds } },
  });

  const existing = await tx.requirementTag.findMany({
    where: { requirementId, tagId: { in: tagIds } },
  });
  const existingIds = new Set(existing.map((r: any) => r.tagId));

  for (const tagId of tagIds) {
    if (!existingIds.has(tagId)) {
      await tx.requirementTag.create({
        data: { requirementId, tagId },
      });
    }
  }

  return normalized;
}
