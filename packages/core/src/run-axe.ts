import type { Page } from 'playwright';
import { createRequire } from 'node:module';
import type { Issue, IssueNode, Severity } from './types.js';

const require = createRequire(import.meta.url);
// axe-core ships its browser source as a string we can inject into the page.
const axeSource: string = require('axe-core').source;

function impactToSeverity(impact: string | null | undefined): Severity {
  return impact === 'critical' || impact === 'serious'
    ? 'fail'
    : impact === 'moderate'
      ? 'warn'
      : 'info';
}

// --- node fingerprinting -------------------------------------------------
// Identity for the diff is derived from stable, meaningful content, never from
// the css-class selector. axe's selector generator latches onto the random
// Emotion/MUI `css-XXXX` class (it looks unique on the page) and shortens the
// selector around it, dropping the tag and context; the diff then wildcards the
// hash, leaving almost nothing to tell a link from a button. Fingerprinting by
// tag + role + accessible name + rule-specific data (e.g. the contrast color
// pair) is what lets the diff see a same-count element swap. See issue #5.

function attrOf(html: string, name: string): string {
  const m = html.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m?.[1] ?? '';
}
function tagOf(html: string): string {
  return html.match(/^<\s*([a-zA-Z][a-zA-Z0-9-]*)/)?.[1]?.toLowerCase() ?? '';
}
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fingerprintNode(ruleId: string, node: any): string {
  const html: string = typeof node?.html === 'string' ? node.html : '';
  const tag = tagOf(html);
  const role = attrOf(html, 'role');
  const type = attrOf(html, 'type');
  // Accessible-ish name: prefer an explicit label, fall back to visible text.
  const name = (attrOf(html, 'aria-label') || attrOf(html, 'alt') || attrOf(html, 'title') || textOf(html)).slice(0, 48);
  let extra = '';
  if (ruleId.startsWith('color-contrast')) {
    const checks: any[] = [...(node?.any ?? []), ...(node?.all ?? []), ...(node?.none ?? [])];
    const data = checks.map((c) => c?.data).find((d) => d && (d.fgColor || d.bgColor)) ?? {};
    extra = [data.fgColor, data.bgColor, data.contrastRatio].filter(Boolean).join(':');
  }
  const fp = [tag, role, type, name, extra].filter(Boolean).join('~');
  // Last-resort fallback so a fingerprint is never empty.
  return fp || (Array.isArray(node?.target) ? node.target.join(' ') : '');
}

function nodesOf(ruleId: string, rawNodes: any[]): IssueNode[] {
  return (rawNodes ?? []).map((n) => ({
    fingerprint: fingerprintNode(ruleId, n),
    target: Array.isArray(n?.target) ? n.target.join(', ').slice(0, 160) : undefined,
  }));
}

function extractWcag(tags: string[]): { ref?: string; level?: 'A' | 'AA' | 'AAA' } {
  const t = tags.find((x) => /^wcag\d{3,4}$/.test(x));
  if (!t) return {};
  const n = t.replace('wcag', '');
  const ref = `WCAG ${n[0]}.${n[1]}.${n[2]}${n[3] ?? ''}`;
  // Level is carried separately by axe tags (wcag2a / wcag2aa / wcag21aa ...).
  const level = tags.some((x) => /aaa$/.test(x))
    ? 'AAA'
    : tags.some((x) => /aa$/.test(x))
      ? 'AA'
      : 'A';
  return { ref, level };
}

/**
 * Run axe-core inside an already-rendered page and normalize the result into our
 * Issue shape. Violations become fail/warn by impact; "incomplete" results (axe
 * could not be sure) become honest "manual" items rather than silent passes.
 */
export async function runAxe(page: Page): Promise<Issue[]> {
  await page.addScriptTag({ content: axeSource });
  const raw = await page.evaluate(async () => {
    // @ts-expect-error axe is injected at runtime
    return await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      resultTypes: ['violations', 'incomplete'],
      // Enhanced contrast is AAA; do not gate on it.
      rules: { 'color-contrast-enhanced': { enabled: false } },
    });
  });

  const issues: Issue[] = [];

  for (const v of (raw as any).violations ?? []) {
    const { ref, level } = extractWcag(v.tags ?? []);
    const node = v.nodes?.[0];
    issues.push({
      id: `axe-${v.id}`,
      severity: impactToSeverity(v.impact),
      title: v.help,
      description: v.description,
      fix: (node?.failureSummary ?? v.help)?.replace(/Fix (any|all) of the following:\n/g, '').trim(),
      wcagRef: ref,
      wcagLevel: level,
      element: node?.target?.join(', ')?.slice(0, 160),
      impact: v.impact,
      instanceCount: v.nodes?.length ?? 1,
      nodes: nodesOf(v.id, v.nodes),
    });
  }

  for (const inc of (raw as any).incomplete ?? []) {
    const { ref, level } = extractWcag(inc.tags ?? []);
    issues.push({
      id: `axe-${inc.id}-review`,
      severity: 'manual',
      title: inc.help,
      description: inc.description,
      fix: `Needs manual review: ${inc.help}`,
      wcagRef: ref,
      wcagLevel: level,
      element: inc.nodes?.[0]?.target?.join(', ')?.slice(0, 160),
      impact: 'needs-review',
      instanceCount: inc.nodes?.length ?? 1,
      nodes: nodesOf(inc.id, inc.nodes),
    });
  }

  return issues;
}
