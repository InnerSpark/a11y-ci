import type { Issue } from '@a11yci/core';
import type { DiffEntry, DiffResult } from '@a11yci/diff';

const SEV_RANK: Record<string, number> = { fail: 3, warn: 2, manual: 1, info: 0, pass: 0 };
const IMPACT_RANK: Record<string, number> = { critical: 4, serious: 3, moderate: 2, minor: 1 };

function badge(issue: Issue): string {
  if (issue.severity === 'fail') return '🔴 Fail';
  if (issue.severity === 'warn') return '🟠 Warn';
  if (issue.severity === 'manual') return '🔵 Review';
  return 'ℹ️ Info';
}

/** Rank by user impact, not by WCAG clause number: severity first, then axe
 * impact, then how many nodes are affected. */
function rank(a: DiffEntry, b: DiffEntry): number {
  const s = (SEV_RANK[b.issue.severity] ?? 0) - (SEV_RANK[a.issue.severity] ?? 0);
  if (s !== 0) return s;
  const i = (IMPACT_RANK[b.issue.impact ?? ''] ?? 0) - (IMPACT_RANK[a.issue.impact ?? ''] ?? 0);
  if (i !== 0) return i;
  return (b.issue.instanceCount ?? 1) - (a.issue.instanceCount ?? 1);
}

function line(e: DiffEntry): string {
  const i = e.issue;
  const where = i.element ? ` \`${i.element.slice(0, 80)}\`` : '';
  const ref = i.wcagRef ? ` _(${i.wcagRef}${i.wcagLevel ? ' ' + i.wcagLevel : ''})_` : '';
  const fix = i.fix ? `\n  - Fix: ${i.fix.slice(0, 200)}` : '';
  return `- ${badge(i)} **${i.title}**${ref} — \`${e.url}\`${where}${fix}`;
}

export function formatMarkdown(d: DiffResult): string {
  const added = [...d.added].sort(rank);
  const fails = added.filter((e) => e.issue.severity === 'fail').length;
  const warns = added.filter((e) => e.issue.severity === 'warn').length;
  const manual = added.filter((e) => e.issue.severity === 'manual').length;

  const out: string[] = [];
  out.push('## ♿ a11y-ci');

  if (added.length === 0) {
    out.push('');
    out.push('No new accessibility issues introduced by this pull request. 🎉');
    if (d.fixed.length) out.push(`\nAnd it **fixes ${d.fixed.length}** existing issue(s). Nice.`);
    out.push(footer(d));
    return out.join('\n');
  }

  const parts = [
    fails ? `**${fails}** new fail${fails === 1 ? '' : 's'}` : '',
    warns ? `**${warns}** new warning${warns === 1 ? '' : 's'}` : '',
    manual ? `**${manual}** needing review` : '',
  ].filter(Boolean);
  out.push('');
  out.push(`This PR introduces ${parts.join(', ')}. Listed worst-first by user impact.`);
  out.push('');
  for (const e of added) out.push(line(e));

  if (d.fixed.length) {
    out.push('');
    out.push(`<details><summary>✅ Also fixes ${d.fixed.length} existing issue(s)</summary>\n`);
    for (const e of [...d.fixed].sort(rank).slice(0, 20)) out.push(`- ${e.issue.title} — \`${e.url}\``);
    out.push('</details>');
  }

  out.push(footer(d));
  return out.join('\n');
}

function footer(d: DiffResult): string {
  return [
    '',
    '---',
    `_Only issues this PR **changes** are shown. ${d.unchanged.length} pre-existing issue(s) were left untouched and are not gated here. "Review" items need a human; they are advisory, never an automatic pass or fail._`,
  ].join('\n');
}
