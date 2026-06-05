import type { AuditResult, Issue } from '@a11yci/core';

export interface DiffEntry {
  url: string;
  issue: Issue;
  /** For `added` entries only: 'new' = a signature absent from base; 'worsened'
   * = an existing signature that head has MORE instances of than base (the page
   * already had this bug; the PR adds more of it). Absent on fixed/unchanged. */
  change?: 'new' | 'worsened';
  /** For 'worsened' entries: how many additional instances head introduces. The
   * entry's `issue.instanceCount` is set to this delta, so the gate reports the
   * regression, not the whole pre-existing pile. */
  addedInstances?: number;
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
 * Aggregate a page's issues by signature, summing instance counts.
 *
 * axe reports one issue per rule per page (with `instanceCount` = number of
 * offending nodes and `element` = the FIRST node), so set-membership alone is
 * blind to a PR that adds MORE instances of a rule already firing on the page:
 * same signature, same first node, higher count. Carrying the count lets the
 * diff catch that regression. See keyOf for what counts as the same signature.
 */
function countsByKey(issues: Issue[]): Map<string, { count: number; issue: Issue }> {
  const m = new Map<string, { count: number; issue: Issue }>();
  for (const issue of issues) {
    const k = keyOf(issue);
    const inc = issue.instanceCount ?? 1;
    const prev = m.get(k);
    if (prev) prev.count += inc;
    else m.set(k, { count: inc, issue });
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
    const baseMap = countsByKey(baseIssues ?? []);
    const headMap = countsByKey(headPage.issues);

    for (const [k, h] of headMap) {
      const b = baseMap.get(k);
      if (!b) {
        // A signature base never had: wholly new.
        result.added.push({ url: headPage.url, issue: h.issue, change: 'new' });
      } else if (h.count > b.count) {
        // Same bug, but the PR adds instances of it. Gate the delta only, so the
        // report says "+N new", not the whole pre-existing pile.
        const addedInstances = h.count - b.count;
        result.added.push({
          url: headPage.url,
          issue: { ...h.issue, instanceCount: addedInstances },
          change: 'worsened',
          addedInstances,
        });
      } else {
        // Present in both at the same or lower count: not a regression. (A lower
        // count is a partial fix; we don't gate improvements.)
        result.unchanged.push({ url: headPage.url, issue: h.issue });
      }
    }
    for (const [k, b] of baseMap) {
      if (!headMap.has(k)) result.fixed.push({ url: headPage.url, issue: b.issue });
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
