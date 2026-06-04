import type { Issue } from './types.js';

/**
 * A simple, transparent score in [0, 100]. Weighted issue load on a fixed scale.
 *
 * This is deliberately a coarse health signal, NOT the gate. CI decisions are
 * made by the diff (did this PR add new issues?), not by a score delta. AAA-level
 * issues are excluded so the score reflects the AA target.
 */
const WEIGHTS: Record<string, number> = { fail: 2.5, warn: 1, manual: 0.25, info: 0, pass: 0 };

export function scoreIssues(issues: Issue[]): number {
  const weighted = issues
    .filter((i) => i.wcagLevel !== 'AAA')
    .reduce((sum, i) => sum + (WEIGHTS[i.severity] ?? 0), 0);
  // Log compression so a long page does not nosedive to zero.
  const penalty = Math.min(100, Math.log2(1 + weighted) * 18);
  return Math.max(0, Math.round(100 - penalty));
}
