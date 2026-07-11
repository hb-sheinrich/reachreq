import { prisma } from '../lib/prisma.js';

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.toISOString() === b.toISOString();
  if (a instanceof Date || b instanceof Date) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}

function computeDiff(prev: Record<string, unknown>, curr: Record<string, unknown>): Record<string, unknown> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
  for (const key of keys) {
    const from = prev[key] ?? null;
    const to = curr[key] ?? null;
    if (!deepEqual(from, to)) {
      diff[key] = { from, to };
    }
  }
  return diff;
}

function extractTags(requirement: any): string[] {
  if (!requirement) return [];
  if (Array.isArray(requirement.tags)) {
    if (requirement.tags.length === 0) return [];
    if (typeof requirement.tags[0] === 'string') {
      return requirement.tags.filter((t: any) => Boolean(t));
    }
    return requirement.tags
      .map((t: any) => (typeof t === 'string' ? t : t?.tag?.name ?? t?.name))
      .filter(Boolean);
  }
  return [];
}

function buildRequirementSnapshot(requirement: any, tags?: string[]): Record<string, unknown> {
  const tagList = tags ?? extractTags(requirement);
  return {
    title: requirement.title ?? null,
    category: requirement.category ?? null,
    goal: requirement.goal ?? null,
    precondition: requirement.precondition ?? null,
    postcondition: requirement.postcondition ?? null,
    mainFlow: requirement.mainFlow ?? null,
    alternativeFlows: requirement.alternativeFlows ?? null,
    technicalAppendix: requirement.technicalAppendix ?? null,
    classification: requirement.classification ?? null,
    status: requirement.status ?? null,
    source: requirement.source ?? null,
    originalLanguage: requirement.originalLanguage ?? 'de',
    tags: tagList,
    reviewedByCe: requirement.reviewedByCe ?? false,
    reviewedAtCe: requirement.reviewedAtCe ?? null,
    reviewerCeId: requirement.reviewerCeId ?? null,
    reviewedByAscShe: requirement.reviewedByAscShe ?? false,
    reviewedAtAscShe: requirement.reviewedAtAscShe ?? null,
    reviewerAscSheId: requirement.reviewerAscSheId ?? null,
    jiraIssueKey: requirement.jiraIssueKey ?? null,
    jiraIssueUrl: requirement.jiraIssueUrl ?? null,
    jiraIssueCreatedAt: requirement.jiraIssueCreatedAt ?? null,
  };
}

export async function createRequirementVersion(
  tx: any,
  requirement: any,
  changeType: string,
  authorId: string,
  changeComment?: string,
  tags?: string[]
) {
  const latest = await tx.requirementVersion.findFirst({
    where: { requirementId: requirement.id },
    orderBy: { versionNumber: 'desc' },
  });

  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const currentSnapshot = buildRequirementSnapshot(requirement, tags);
  const previousSnapshot = latest ? buildRequirementSnapshot(latest, latest.tags) : null;
  const diff = previousSnapshot ? computeDiff(previousSnapshot, currentSnapshot) : null;

  const versionTags = tags ?? extractTags(requirement);

  return tx.requirementVersion.create({
    data: {
      requirementId: requirement.id,
      versionNumber,
      changeComment,
      changeType,
      title: requirement.title,
      category: requirement.category,
      goal: requirement.goal,
      precondition: requirement.precondition,
      postcondition: requirement.postcondition,
      mainFlow: requirement.mainFlow ?? null,
      alternativeFlows: requirement.alternativeFlows ?? null,
      technicalAppendix: requirement.technicalAppendix ?? null,
      classification: requirement.classification,
      status: requirement.status,
      source: requirement.source,
      originalLanguage: requirement.originalLanguage ?? 'de',
      moduleId: requirement.moduleId,
      authorId,
      tags: versionTags,
      reviewedByCe: requirement.reviewedByCe ?? false,
      reviewedAtCe: requirement.reviewedAtCe ?? null,
      reviewerCeId: requirement.reviewerCeId,
      reviewedByAscShe: requirement.reviewedByAscShe ?? false,
      reviewedAtAscShe: requirement.reviewedAtAscShe ?? null,
      reviewerAscSheId: requirement.reviewerAscSheId,
      jiraIssueKey: requirement.jiraIssueKey,
      jiraIssueUrl: requirement.jiraIssueUrl,
      jiraIssueCreatedAt: requirement.jiraIssueCreatedAt,
      diff,
    },
  });
}

export async function createGlossaryVersion(
  tx: any,
  entry: any,
  data: any,
  authorId: string,
  changeComment?: string
) {
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
      changeComment,
      term: data.term,
      definition: data.definition,
      example: data.example,
      tags: data.tags ?? [],
      aliases: data.aliases ?? [],
      status: data.status,
      originalLanguage: data.originalLanguage ?? entry.originalLanguage ?? 'de',
      authorId,
    },
  });
}
