import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../lib/env.js';

export interface UseCase {
  id?: string;
  title: string;
  category?: string | null;
  goal?: string | null;
  precondition?: string | null;
  postcondition?: string | null;
  mainFlow?: unknown;
  alternativeFlows?: unknown;
  technicalAppendix?: unknown;
  tags?: string[];
  aliases?: string[];
}

export interface UseCaseTranslation {
  title?: string | null;
  category?: string | null;
  goal?: string | null;
  precondition?: string | null;
  postcondition?: string | null;
  mainFlow?: unknown;
  alternativeFlows?: unknown;
  technicalAppendix?: unknown;
  aliases?: string[];
}

export interface GlossaryEntryPayload {
  term: string;
  definition: string;
  example?: string | null;
  aliases?: string[];
}

export interface GlossaryTranslation {
  term?: string | null;
  definition?: string | null;
  aliases?: string[];
}

function getClient() {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey });
}

function stripJsonFences(text: string): string {
  return text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(stripJsonFences(text)) as T;
  } catch {
    return null;
  }
}

export async function translateUseCase(payload: UseCase, targetLang: 'de' | 'en'): Promise<UseCaseTranslation> {
  const model = getEnv().ANTHROPIC_MODEL;
  const keys = ['title', 'category', 'goal', 'precondition', 'postcondition', 'mainFlow', 'alternativeFlows', 'technicalAppendix', 'aliases'];

  const response = await getClient().messages.create(
    {
      model,
      max_tokens: 4096,
      system: 'You are a professional translator for software requirements. Respond only with a single valid JSON object, no markdown, no explanations. Preserve all JSON keys and structure; only translate human-readable string values.',
      messages: [
        {
          role: 'user',
          content: `Translate the following content to ${targetLang}. Return a JSON object with these keys: ${keys.join(', ')}.\n\nInput: ${JSON.stringify(payload)}`,
        },
      ],
    },
    { timeout: 60_000 },
  );

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');

  const parsed = safeParseJson<Partial<UseCaseTranslation>>(text);
  if (!parsed) {
    throw new Error('Translation service returned invalid JSON');
  }

  return {
    title: parsed.title ?? null,
    category: parsed.category ?? null,
    goal: parsed.goal ?? null,
    precondition: parsed.precondition ?? null,
    postcondition: parsed.postcondition ?? null,
    mainFlow: parsed.mainFlow ?? null,
    alternativeFlows: parsed.alternativeFlows ?? null,
    technicalAppendix: parsed.technicalAppendix ?? null,
    aliases: parsed.aliases ?? [],
  };
}

export async function translateGlossaryEntry(payload: GlossaryEntryPayload, targetLang: 'de' | 'en'): Promise<GlossaryTranslation> {
  const model = getEnv().ANTHROPIC_MODEL;

  const response = await getClient().messages.create({
    model,
    max_tokens: 2048,
    system: 'You are a professional translator for glossary entries. Respond only with a single valid JSON object, no markdown, no explanations. Preserve the JSON keys term, definition, and aliases.',
    messages: [
      {
        role: 'user',
        content: `Translate the following glossary entry to ${targetLang}. Return a JSON object with keys: term, definition, aliases.\n\nInput: ${JSON.stringify(payload)}`,
      },
    ],
  });

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');

  const parsed = safeParseJson<Partial<GlossaryTranslation>>(text);
  if (!parsed) {
    throw new Error('Translation service returned invalid JSON');
  }

  return {
    term: parsed.term ?? null,
    definition: parsed.definition ?? null,
    aliases: parsed.aliases ?? [],
  };
}
