import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../lib/env.js';

export interface ReviewIssue {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ReviewResult {
  passed: boolean;
  blockers: ReviewIssue[];
  warnings: ReviewIssue[];
  suggestions: ReviewIssue[];
}

interface ReviewPayload {
  title: string;
  description: string;
  context?: string;
  acceptanceCriteria?: string[];
  source?: string;
  type: 'requirement' | 'glossary';
  term?: string;
  definition?: string;
  example?: string;
}

function client(): Anthropic {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey });
}

export async function reviewRequirement(payload: ReviewPayload): Promise<ReviewResult> {
  const model = getEnv().ANTHROPIC_MODEL;
  const prompt = buildPrompt(payload);

  try {
    const response = await client().messages.create({
      model,
      max_tokens: 2048,
      system: 'Du bist ein Qualitätsmanager für Software-Anforderungen. Antworte ausschließlich in einem gültigen JSON-Format.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    return parseReviewResult(text);
  } catch (err) {
    return {
      passed: false,
      blockers: [{ field: 'ai', message: err instanceof Error ? err.message : 'AI-Prüfung fehlgeschlagen' }],
      warnings: [],
      suggestions: [],
    };
  }
}

export async function reviewGlossary(payload: ReviewPayload): Promise<ReviewResult> {
  return reviewRequirement(payload);
}

function buildPrompt(payload: ReviewPayload): string {
  if (payload.type === 'glossary') {
    return `Bewerte den folgenden Glossareintrag für Vollständigkeit, Verständlichkeit, Rechtschreibung und Eindeutigkeit.

Begriff: ${payload.term ?? ''}
Definition: ${payload.definition ?? ''}
Beispiel: ${payload.example ?? ''}

Gib ein JSON-Objekt zurück:
{
  "blockers": [{"field": "...", "message": "...", "suggestion": "..."}],
  "warnings": [...],
  "suggestions": [...]
}

blockers: Fehler, die korrigiert werden müssen, bevor der Eintrag freigegeben werden kann.
warnings: Hinweise, die Autor:in bewusst ignorieren kann, aber begründen sollte.
suggestions: Optionale Verbesserungsvorschläge.
`;
  }

  return `Bewerte die folgende Anforderung für Rechtschreibung, Grammatik, Verständlichkeit, Vollständigkeit und Eindeutigkeit.

Titel: ${payload.title}
Beschreibung: ${payload.description}
Kontext: ${payload.context ?? ''}
Akzeptanzkriterien: ${(payload.acceptanceCriteria ?? []).join('\n')}
Quelle: ${payload.source ?? ''}

Gib ein JSON-Objekt zurück:
{
  "blockers": [{"field": "...", "message": "...", "suggestion": "..."}],
  "warnings": [...],
  "suggestions": [...]
}

blockers: Fehler, die korrigiert werden müssen, bevor die Anforderung freigegeben werden kann.
warnings: Hinweise, die Autor:in bewusst ignorieren kann, aber begründen sollte.
suggestions: Optionale Verbesserungsvorschläge.
`;
}

function parseReviewResult(text: string): ReviewResult {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const blockers = Array.isArray(parsed.blockers) ? parsed.blockers : [];
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const normalize = (i: unknown): ReviewIssue => ({
    field: (i as { field?: string })?.field ?? 'general',
    message: (i as { message?: string })?.message ?? String(i),
    suggestion: (i as { suggestion?: string })?.suggestion,
  });
  return {
    passed: blockers.length === 0,
    blockers: blockers.map(normalize),
    warnings: warnings.map(normalize),
    suggestions: suggestions.map(normalize),
  };
}
