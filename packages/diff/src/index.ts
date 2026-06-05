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

/** Rule-and-criterion identity for a page (NOT the element). Instances within a
 * rule are then told apart by their node fingerprints, below. */
function ruleKey(issue: Issue): string {
  return [issue.id, issue.wcagRef ?? ''].join('|');
}

/**
 * The per-node identity multiset for an issue.
 *
 * Prefer the engine's content fingerprints (`issue.nodes`), which ignore the
 * css-class selector entirely, so a removed link and an added button are
 * distinct even when their selectors both normalize to `#main .css-*`. That is
 * what makes a same-count swap visible (issue #5). When fingerprints are absent
 * (older JSON, or a non-axe source), fall back to the normalized selector
 * repeated `instanceCount` times, which preserves the previous count-aware
 * behavior and still absorbs framework-hash churn.
 */
function fingerprintsOf(issue: Issue): string[] {
  if (issue.nodes && issue.nodes.length > 0) return issue.nodes.map((n) => n.fingerprint);
  const fp = normalizeSelector(issue.element);
  return Array.from({ length: issue.instanceCount ?? 1 }, () => fp);
}

interface RuleGroup {
  issue: Issue; // a representative, for the report
  counts: Map<string, number>; // fingerprint -> how many nodes carry it
}

function groupByRule(issues: Issue[]): Map<string, RuleGroup> {
  const groups = new Map<string, RuleGroup>();
  for (const issue of issues) {
    const key = ruleKey(issue);
    let g = groups.get(key);
    if (!g) {
      g = { issue, counts: new Map() };
      groups.set(key, g);
    }
    for (const fp of fingerprintsOf(issue)) g.counts.set(fp, (g.counts.get(fp) ?? 0) + 1);
  }
  return groups;
}

function pagesByUrl(result: AuditResult): Map<string, Issue[]> {
  const m = new Map<string, Issue[]>();
  for (const p of result.pages) {
    if (p.error) continue; // an errored page has no trustworthy issue list
    m.set(p.url, p.issues);
  }
  return m;
}

/** Multiset difference: total instances in `a` that `b` does not account for. */
function excessInstances(a: Map<string, number>, b: Map<string, number>): number {
  let n = 0;
  for (const [fp, count] of a) n += Math.max(0, count - (b.get(fp) ?? 0));
  return n;
}

/**
 * Compare a base audit (e.g. the target branch) against a head audit (the PR).
 * Pages are matched by URL. A head page with no base counterpart is treated as
 * new, so all its issues count as added. A base page missing from head (route
 * removed) is ignored.
 *
 * Identity is per node, by content fingerprint, so the diff catches not just new
 * rules and higher counts but also same-count swaps (a removed offending node
 * replaced by a different one). It still absorbs framework-hash churn, since the
 * fingerprint does not include the volatile css class. See issue #5.
 */
export function diff(base: AuditResult, head: AuditResult): DiffResult {
  const basePages = pagesByUrl(base);
  const result: DiffResult = { added: [], fixed: [], unchanged: [] };

  for (const headPage of head.pages) {
    if (headPage.error) continue;
    const baseGroups = groupByRule(basePages.get(headPage.url) ?? []);
    const headGroups = groupByRule(headPage.issues);

    for (const [key, h] of headGroups) {
      const b = baseGroups.get(key);
      if (!b) {
        // A rule base never had on this page: wholly new.
        result.added.push({ url: headPage.url, issue: h.issue, change: 'new' });
        continue;
      }
      // Fingerprints present in head beyond what base had = newly introduced
      // instances (covers both "more of the same" and a swap to a new element).
      const addedInstances = excessInstances(h.counts, b.counts);
      if (addedInstances > 0) {
        result.added.push({
          url: headPage.url,
          issue: { ...h.issue, instanceCount: addedInstances },
          change: 'worsened',
          addedInstances,
        });
      } else {
        // Same instances, or fewer (a partial fix; improvements are not gated).
        result.unchanged.push({ url: headPage.url, issue: h.issue });
      }
    }
    for (const [key, b] of baseGroups) {
      if (!headGroups.has(key)) result.fixed.push({ url: headPage.url, issue: b.issue });
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
