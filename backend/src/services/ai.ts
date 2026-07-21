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
  goal?: string;
  precondition?: string;
  postcondition?: string;
  mainFlow?: unknown;
  alternativeFlows?: unknown;
  technicalAppendix?: unknown;
  classification?: string;
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
    const response = await client().messages.create(
      {
        model,
        max_tokens: 4096,
        system: 'Du bist ein Qualitätsmanager für Software-Anforderungen. Antworte ausschließlich in einem gültigen JSON-Format.',
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: 60_000 },
    );

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
Ziel: ${payload.goal ?? ''}
Vorbedingung: ${payload.precondition ?? ''}
Basisablauf: ${Array.isArray(payload.mainFlow) ? payload.mainFlow.join('\n') : ''}
Alternative Abläufe: ${Array.isArray(payload.alternativeFlows) ? payload.alternativeFlows.map((f: any) => `[${f.title || f.id || ''} nach Schritt ${f.afterStep ?? ''}]\n${f.steps?.join('\n')}`).join('\n') : ''}
Nachbedingung: ${payload.postcondition ?? ''}
Technischer Anhang: ${JSON.stringify(payload.technicalAppendix ?? {})}
Klassifizierung: ${payload.classification ?? ''}
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

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function parseReviewResult(text: string): ReviewResult {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const extracted = extractJsonObject(cleaned);
    if (extracted) {
      try {
        parsed = JSON.parse(extracted);
      } catch {
        throw new Error('AI response is not valid JSON');
      }
    } else {
      throw new Error('AI response is not valid JSON');
    }
  }
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
