#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { audit, type AuditResult } from '@a11yci/core';
import { diff, gatingRegressions } from '@a11yci/diff';
import { createAnthropicAdapter } from '@a11yci/llm';
import { formatMarkdown } from '../report.js';

function parseFlags(argv: string[]): { _: string[]; flags: Record<string, string | boolean> } {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

const USAGE = `a11y-ci — accessibility regression checks for CI

Usage:
  a11y-ci audit <url...> [--out file.json] [--chrome] [--timeout 120000] [--semantic]
  a11y-ci diff --base base.json --head head.json [--format markdown|json]
               [--out comment.md] [--fail-on none|new-warn|new-serious] [--suggest-fixes]

Notes:
  - "audit" renders each URL, runs the deterministic engine, and writes an AuditResult.
  - "diff" reports only the issues head adds over base (regression-only).
  - Exit code is non-zero only when --fail-on is set and matching regressions exist.
  - --semantic and --suggest-fixes use Claude (set ANTHROPIC_API_KEY). Both are
    advisory: they never change the deterministic pass/fail decision.
`;

async function cmdAudit(_: string[], flags: Record<string, string | boolean>): Promise<number> {
  const urls = _;
  if (urls.length === 0) { console.error('audit: provide at least one URL\n\n' + USAGE); return 2; }
  // --semantic enables the optional AI review (the checks axe can't judge).
  // Strictly advisory: findings come back at "manual" severity.
  let llm;
  if (flags.semantic) {
    llm = createAnthropicAdapter() ?? undefined;
    if (!llm) console.error('audit: --semantic needs ANTHROPIC_API_KEY; running deterministic-only.');
  }
  const result = await audit(urls, {
    useChromeChannel: Boolean(flags.chrome),
    timeoutMs: flags.timeout ? Number(flags.timeout) : undefined,
    llm,
  });
  const json = JSON.stringify(result, null, 2);
  if (typeof flags.out === 'string') { writeFileSync(flags.out, json); console.error(`Wrote ${flags.out}`); }
  else process.stdout.write(json + '\n');

  const fails = result.issues.filter((i) => i.severity === 'fail').length;
  const warns = result.issues.filter((i) => i.severity === 'warn').length;
  const errored = result.pages.filter((p) => p.error);
  console.error(`Audited ${result.pages.length} page(s): score ${result.overallScore}/100, ${fails} fail(s), ${warns} warn(s).`);
  for (const p of errored) console.error(`  ! ${p.url}: ${p.error}`);
  return 0;
}

function load(path: string): AuditResult {
  return JSON.parse(readFileSync(path, 'utf8')) as AuditResult;
}

async function cmdDiff(_: string[], flags: Record<string, string | boolean>): Promise<number> {
  if (typeof flags.base !== 'string' || typeof flags.head !== 'string') {
    console.error('diff: --base and --head are required\n\n' + USAGE); return 2;
  }
  const d = diff(load(flags.base), load(flags.head));

  // --suggest-fixes attaches an AI fix suggestion to each NEW issue. Advisory,
  // bounded, and a no-op (with a note) when no ANTHROPIC_API_KEY is present.
  if (flags['suggest-fixes']) {
    const llm = createAnthropicAdapter();
    if (!llm?.suggestFix) {
      console.error('diff: --suggest-fixes needs ANTHROPIC_API_KEY; skipping fix suggestions.');
    } else {
      for (const entry of d.added.slice(0, 12)) {
        try {
          const fix = await llm.suggestFix(entry.issue);
          if (fix) entry.issue.aiFix = fix;
        } catch { /* advisory: never fail the run on a suggestion error */ }
      }
    }
  }

  if (flags.format === 'json') {
    const json = JSON.stringify(d, null, 2);
    if (typeof flags.out === 'string') writeFileSync(flags.out, json);
    else process.stdout.write(json + '\n');
  } else {
    const md = formatMarkdown(d);
    if (typeof flags.out === 'string') { writeFileSync(flags.out, md); console.error(`Wrote ${flags.out}`); }
    else process.stdout.write(md + '\n');
  }

  const failOn = typeof flags['fail-on'] === 'string' ? (flags['fail-on'] as string) : 'none';
  if (failOn === 'none') return 0;
  const minSeverity = failOn === 'new-warn' ? 'warn' : 'fail';
  const blocking = gatingRegressions(d, minSeverity);
  if (blocking.length > 0) {
    console.error(`a11y-ci: failing — ${blocking.length} new ${minSeverity}+ issue(s) introduced by this change.`);
    return 1;
  }
  return 0;
}

async function main(): Promise<number> {
  const [, , cmd, ...rest] = process.argv;
  const { _, flags } = parseFlags(rest);
  switch (cmd) {
    case 'audit': return cmdAudit(_, flags);
    case 'diff': return cmdDiff(_, flags);
    case 'help': case undefined: console.log(USAGE); return 0;
    default: console.error(`Unknown command: ${cmd}\n\n` + USAGE); return 2;
  }
}

main().then((code) => process.exit(code)).catch((e) => { console.error(e); process.exit(1); });
