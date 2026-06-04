import { renderPage } from './render.js';
import { runAxe } from './run-axe.js';
import { scoreIssues } from './score.js';
import type { AuditOptions, AuditResult, Issue, PageResult } from './types.js';

export * from './types.js';

function applyRules(issues: Issue[], rules: AuditOptions['rules']): Issue[] {
  if (!rules) return issues;
  const out: Issue[] = [];
  for (const issue of issues) {
    const rule = rules[issue.id];
    if (rule?.enabled === false) continue;
    out.push(rule?.severity ? { ...issue, severity: rule.severity } : issue);
  }
  return out;
}

/** Audit a single URL. Never throws on a page-level failure: a page that cannot
 * be rendered is returned as an error result, not a silent 100. */
export async function auditUrl(url: string, opts: AuditOptions = {}): Promise<PageResult> {
  let handle;
  try {
    handle = await renderPage(url, { useChromeChannel: opts.useChromeChannel, timeoutMs: opts.timeoutMs });
  } catch (e: any) {
    return { url, score: 0, issues: [], renderMode: 'playwright', error: `Render failed: ${e?.message ?? e}` };
  }
  try {
    const found = applyRules(await runAxe(handle.page), opts.rules);
    if (opts.llm?.semanticReview) {
      try {
        const html = await handle.page.content();
        const extra = await opts.llm.semanticReview({ url, html });
        // Advisory only: tag as manual so it can never flip the deterministic gate.
        for (const e of extra) found.push({ ...e, severity: 'manual' });
      } catch { /* advisory layer must never fail the audit */ }
    }
    return { url, score: scoreIssues(found), issues: found, renderMode: 'playwright' };
  } catch (e: any) {
    return { url, score: 0, issues: [], renderMode: 'playwright', error: `Audit failed: ${e?.message ?? e}` };
  } finally {
    await handle.browser.close().catch(() => {});
  }
}

/** Audit one or more URLs into a single AuditResult. */
export async function audit(urls: string | string[], opts: AuditOptions = {}): Promise<AuditResult> {
  const list = Array.isArray(urls) ? urls : [urls];
  const pages: PageResult[] = [];
  for (const url of list) {
    pages.push(await auditUrl(url, opts));
  }
  const issues = pages.flatMap((p) => p.issues);
  const scored = pages.filter((p) => !p.error);
  const overallScore = scored.length
    ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length)
    : 0;
  return { timestamp: new Date().toISOString(), pages, issues, overallScore };
}
