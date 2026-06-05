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
  // Prefer the live-DOM enrichment computed in-page (issue #5): real accessible
  // name, role, and colours, immune to axe's html truncation and class churn.
  const e = node?._fp;
  if (e) {
    let extra = '';
    if (ruleId.startsWith('color-contrast')) {
      const checks: any[] = [...(node?.any ?? []), ...(node?.all ?? []), ...(node?.none ?? [])];
      const data = checks.map((c) => c?.data).find((d) => d && (d.fgColor || d.bgColor));
      // Prefer axe's composited colours; fall back to the computed ones.
      extra = [data?.fgColor || e.fg, data?.bgColor || e.bg, data?.contrastRatio].filter(Boolean).join(':');
    }
    const fp = [e.tag, e.role, e.name, extra].filter(Boolean).join('~');
    if (fp) return fp;
  }

  // Fallback: parse axe's (possibly truncated) node.html.
  const html: string = typeof node?.html === 'string' ? node.html : '';
  const tag = tagOf(html);
  const role = attrOf(html, 'role');
  const type = attrOf(html, 'type');
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
    const result = await (window as any).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      resultTypes: ['violations', 'incomplete'],
      // Enhanced contrast is AAA; do not gate on it.
      rules: { 'color-contrast-enhanced': { enabled: false } },
    });

    // Live-DOM enrichment for stable fingerprints (issue #5). Instead of parsing
    // axe's truncated node.html, read the real element: a best-effort accessible
    // name, its role, and computed colours. This survives Emotion-style class
    // churn and gives contrast nodes a colour signal even when there is no text.
    const accName = (el: Element): string => {
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const t = labelledby.split(/\s+/).map((id) => {
          const r = document.getElementById(id);
          return r ? (r.textContent || '').trim() : '';
        }).filter(Boolean).join(' ');
        if (t) return t;
      }
      const label = el.getAttribute('aria-label');
      if (label && label.trim()) return label.trim();
      if (el.id) {
        try {
          const f = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
          if (f && (f.textContent || '').trim()) return (f.textContent || '').trim();
        } catch { /* invalid id */ }
      }
      const wrap = el.closest('label');
      if (wrap && (wrap.textContent || '').trim()) return (wrap.textContent || '').trim();
      if (el.tagName === 'IMG') { const alt = el.getAttribute('alt'); if (alt != null) return alt.trim(); }
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) return text;
      const title = el.getAttribute('title');
      return title ? title.trim() : '';
    };
    const resolveBg = (el: Element): string => {
      let n: Element | null = el;
      while (n) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        n = n.parentElement;
      }
      return 'rgb(255, 255, 255)';
    };
    // Chrome's real computed accessible name/role via AccessibilityObjectModel
    // (enabled by the launch flag). This is spec-correct, unlike the accName
    // heuristic, which stays as the fallback when the API is unavailable.
    const computed = async (el: Element): Promise<{ name: string; role: string } | null> => {
      try {
        const fn = (window as any).getComputedAccessibleNode;
        if (typeof fn === 'function') {
          const can = await fn(el);
          if (can && (can.name || can.role)) return { name: can.name || '', role: can.role || '' };
        }
      } catch { /* not supported; fall back */ }
      return null;
    };
    const enrich = async (node: any): Promise<void> => {
      const sel = Array.isArray(node.target) ? node.target[node.target.length - 1] : node.target;
      let el: Element | null = null;
      try { el = typeof sel === 'string' ? document.querySelector(sel) : null; } catch { /* unselectable */ }
      if (!el) return;
      const cs = getComputedStyle(el);
      const c = await computed(el);
      const name = (c ? c.name : accName(el)).slice(0, 80);
      const role = (c && c.role) || el.getAttribute('role') || '';
      node._fp = { tag: el.tagName.toLowerCase(), role, name, fg: cs.color, bg: resolveBg(el) };
    };
    for (const v of result.violations || []) for (const n of v.nodes || []) await enrich(n);
    for (const inc of result.incomplete || []) for (const n of inc.nodes || []) await enrich(n);
    return result;
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
