import type { Issue, LlmAdapter } from '@a11yci/core';

export interface AnthropicAdapterOptions {
  /** Falls back to process.env.ANTHROPIC_API_KEY. */
  apiKey?: string;
  /** Falls back to process.env.ANTHROPIC_MODEL, then a fast default. */
  model?: string;
  /** Max tokens for a single fix suggestion. */
  maxFixTokens?: number;
}

// A fast, inexpensive default; fix suggestions are short. Override via opts/env.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * An LlmAdapter backed by the Anthropic Messages API. Bring-your-own key.
 *
 * Returns `null` when no API key is available, so callers can wire it in
 * unconditionally and simply get the deterministic-only behaviour with no key.
 * Everything this adapter produces is advisory: fix suggestions are attached to
 * issues for humans to review, and semantic findings are emitted at "manual"
 * severity, so they can never flip a deterministic gate.
 */
export function createAnthropicAdapter(opts: AnthropicAdapterOptions = {}): LlmAdapter | null {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  async function ask(system: string, user: string, maxTokens: number): Promise<string> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey as string,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
  }

  return {
    async suggestFix(issue: Issue): Promise<string | null> {
      const system =
        'You are an accessibility engineer. Given one WCAG issue found by an automated checker, give a concrete, minimal fix. Prefer a corrected code snippet when the element is identifiable. Be specific and brief (no more than ~80 words). If you cannot give a confident fix from the information provided, reply with exactly: NO_FIX';
      const user = [
        `Issue: ${issue.title}`,
        issue.wcagRef ? `WCAG: ${issue.wcagRef}${issue.wcagLevel ? ' ' + issue.wcagLevel : ''}` : '',
        issue.description ? `Detail: ${issue.description}` : '',
        issue.element ? `Element/selector: ${issue.element}` : '',
        issue.fix ? `Automated tool guidance: ${issue.fix}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      try {
        const out = await ask(system, user, opts.maxFixTokens ?? 220);
        if (!out || /^NO_FIX/i.test(out)) return null;
        return out;
      } catch {
        return null; // advisory layer must never break the run
      }
    },

    async semanticReview({ url, html }: { url: string; html: string }): Promise<Issue[]> {
      // The ~60% axe cannot judge: meaningfulness, not presence. Bounded input.
      const snippet = (html ?? '').slice(0, 12000);
      const system =
        'You are an accessibility expert reviewing rendered HTML for problems automated checkers (axe-core) cannot judge: alt text that exists but is unhelpful or wrong; link/button text that is not descriptive ("click here", "read more"); label-in-name mismatches; heading text that does not describe its section; and instructions that rely on sensory characteristics (color, shape, position). Do NOT report things axe already covers (missing alt, color contrast, missing form labels, missing landmarks). Return ONLY a compact JSON array, max 6 items, each: {"title": string, "description": string, "wcagRef": string, "element": string}. If nothing substantive, return [].';
      const user = `URL: ${url}\nHTML:\n${snippet}`;
      try {
        const out = await ask(system, user, 900);
        const start = out.indexOf('[');
        const end = out.lastIndexOf(']');
        if (start === -1 || end === -1) return [];
        const parsed = JSON.parse(out.slice(start, end + 1)) as Array<Record<string, unknown>>;
        return parsed.slice(0, 6).map((p, i) => ({
          id: `llm-semantic-${i}-${String(p.wcagRef ?? '').replace(/\W+/g, '')}`,
          severity: 'manual' as const,
          title: String(p.title ?? 'Possible accessibility issue (AI review)'),
          description: String(p.description ?? ''),
          wcagRef: p.wcagRef ? String(p.wcagRef) : undefined,
          element: p.element ? String(p.element).slice(0, 160) : undefined,
          impact: 'needs-review',
        }));
      } catch {
        return [];
      }
    },
  };
}
