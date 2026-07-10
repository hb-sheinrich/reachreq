import { getEnv } from '../lib/env.js';

export interface JiraIssueInput {
  summary: string;
  description: any;
}

export function buildUseCaseDescription(options: {
  title: string;
  goal?: string | null;
  precondition?: string | null;
  mainFlow?: unknown;
  postcondition?: string | null;
  reachReqUrl: string;
}) {
  const { title, goal, precondition, mainFlow, postcondition, reachReqUrl } = options;

  const steps: string[] = Array.isArray(mainFlow) ? mainFlow.map((s) => String(s)) : [];

  const content: any[] = [
    paragraphNode(`Titel: ${title || '–'}`),
    paragraphNode(`Ziel: ${goal || '–'}`),
    paragraphNode(`Vorbedingung: ${precondition || '–'}`),
  ];

  if (steps.length > 0) {
    content.push({
      type: 'paragraph',
      content: [textNode('Hauptszenario:')],
    });
    content.push({
      type: 'orderedList',
      content: steps.map((step) => ({
        type: 'listItem',
        content: [paragraphNode(step)],
      })),
    });
  } else {
    content.push(paragraphNode('Hauptszenario: –'));
  }

  content.push(paragraphNode(`Nachbedingung: ${postcondition || '–'}`));
  content.push({
    type: 'paragraph',
    content: [
      textNode('Link zu ReachReq: '),
      {
        type: 'text',
        text: reachReqUrl,
        marks: [{ type: 'link', attrs: { href: reachReqUrl } }],
      },
    ],
  });

  return { version: 1, type: 'doc', content };
}

function textNode(text: string): any {
  return { type: 'text', text };
}

function paragraphNode(text: string): any {
  return {
    type: 'paragraph',
    content: [textNode(text)],
  };
}

export async function createJiraIssue(input: JiraIssueInput): Promise<{ key: string; url: string }> {
  const env = getEnv();
  const email = env.JIRA_EMAIL;
  const token = env.JIRA_API_TOKEN;
  if (!email || !token) {
    throw new Error('Jira credentials not configured');
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const body = {
    fields: {
      project: { key: env.JIRA_PROJECT_KEY },
      issuetype: { id: env.JIRA_ISSUE_TYPE_ID },
      summary: input.summary,
      description: input.description,
      customfield_10045: { id: env.JIRA_ACCOUNT_OPTION_ID },
    },
  };

  const res = await fetch(`https://${env.JIRA_HOST}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { key: string; self?: string };
  const key = data.key;
  const url = `https://${env.JIRA_HOST}/browse/${key}`;
  return { key, url };
}
