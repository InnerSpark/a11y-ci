import type { AuditResult, Issue } from '@a11yci/core';

export interface DiffEntry {
  url: string;
  issue: Issue;
}

export interface DiffResult {
  /** Issues present on head but not on the matching base page — the regressions. */
  added: DiffEntry[];
  /** Issues present on base but gone on head — the wins. */
  fixed: DiffEntry[];
  /** Issues present in both. */
  unchanged: DiffEntry[];
}

/**
 * Normalize a selector so cosmetic churn does not read as a new issue.
 * Framework class hashes (MUI/emotion `css-1a2b3c`, styled-components `sc-…`,
 * CSS-modules `Foo__bar___x7d2`) change between builds without the underlying
 * problem changing, so we strip them before comparing.
 */
function normalizeSelector(sel: string | undefined): string {
  if (!sel) return '';
  return sel
    .replace(/css-[a-z0-9]+/gi, 'css-*')
    .replace(/\bsc-[a-z0-9]+/gi, 'sc-*')
    .replace(/__[A-Za-z0-9]+___[A-Za-z0-9]+/g, '__*')
    .replace(/:nth-child\(\d+\)/g, ':nth-child(*)')
    .trim();
}

/** Identity of an issue for diffing: same rule, same place, same criterion. */
function keyOf(issue: Issue): string {
  return [issue.id, issue.wcagRef ?? '', normalizeSelector(issue.element)].join('|');
}

function pagesByUrl(result: AuditResult): Map<string, Issue[]> {
  const m = new Map<string, Issue[]>();
  for (const p of result.pages) {
    if (p.error) continue; // an errored page has no trustworthy issue list
    m.set(p.url, p.issues);
  }
  return m;
}

/**
 * Compare a base audit (e.g. the target branch) against a head audit (the PR).
 * Pages are matched by URL. A head page with no base counterpart is treated as
 * new, so all its issues count as added. A base page missing from head (route
 * removed) is ignored.
 */
export function diff(base: AuditResult, head: AuditResult): DiffResult {
  const basePages = pagesByUrl(base);
  const result: DiffResult = { added: [], fixed: [], unchanged: [] };

  for (const headPage of head.pages) {
    if (headPage.error) continue;
    const baseIssues = basePages.get(headPage.url);
    const baseKeys = new Set((baseIssues ?? []).map(keyOf));
    const headKeys = new Set(headPage.issues.map(keyOf));

    for (const issue of headPage.issues) {
      (baseKeys.has(keyOf(issue)) ? result.unchanged : result.added).push({ url: headPage.url, issue });
    }
    if (baseIssues) {
      for (const issue of baseIssues) {
        if (!headKeys.has(keyOf(issue))) result.fixed.push({ url: headPage.url, issue });
      }
    }
  }

  return result;
}

/** Convenience: the added issues at or above a severity, for gating. */
export function gatingRegressions(d: DiffResult, minSeverity: 'fail' | 'warn' = 'fail'): DiffEntry[] {
  const rank: Record<string, number> = { fail: 3, warn: 2, manual: 1, info: 0, pass: 0 };
  const floor = rank[minSeverity] ?? 3;
  return d.added.filter((e) => (rank[e.issue.severity] ?? 0) >= floor);
}
