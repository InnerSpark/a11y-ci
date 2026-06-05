/** @a11yci/lint — authoring-time accessibility linter.
 *
 * The "shift-left" layer of a11y-ci: it reads source (JSX/TSX and HTML) and
 * flags accessibility anti-patterns before anything renders, so issues are
 * caught in the editor / pre-commit instead of in a rendered CI run. It shares
 * the project's honesty principle — it only reports what it can confidently
 * determine from the markup, and defers contrast / computed-role checks to the
 * rendered @a11yci/core engine. */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { normalize } from './normalize.js';
import { runRules, RULE_IDS } from './rules.js';
import type { LintFinding, LintOptions } from './types.js';

export type { LintFinding, LintSeverity, LintOptions, NormalizedElement } from './types.js';
export { RULE_IDS } from './rules.js';

const DEFAULT_EXTENSIONS = ['.html', '.htm', '.jsx', '.tsx'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out', '.cache']);

function disabledSet(options?: LintOptions): Set<string> {
  const disabled = new Set<string>();
  for (const id of RULE_IDS) {
    if (options?.rules?.[id]?.enabled === false) disabled.add(id);
  }
  return disabled;
}

/** Lint a single source string. `filename` selects the parser by extension. */
export function lintSource(code: string, filename: string, options?: LintOptions): LintFinding[] {
  let elements;
  try {
    elements = normalize(code, filename);
  } catch {
    return []; // a file we can't parse is not a finding; the build/type tools own syntax errors
  }
  return runRules(elements, disabledSet(options));
}

/** Lint one file from disk. */
export function lintFile(file: string, options?: LintOptions): LintFinding[] {
  const code = readFileSync(file, 'utf8');
  return lintSource(code, file, options);
}

function collectFiles(target: string, extensions: string[], acc: string[]): void {
  let st;
  try {
    st = statSync(target);
  } catch {
    return;
  }
  if (st.isDirectory()) {
    for (const entry of readdirSync(target)) {
      if (SKIP_DIRS.has(entry)) continue;
      collectFiles(join(target, entry), extensions, acc);
    }
  } else if (st.isFile() && extensions.includes(extname(target).toLowerCase())) {
    acc.push(target);
  }
}

/** Lint a set of files and/or directories. Directories are walked recursively
 * (skipping node_modules, dist, etc.). Returns findings across all files, in a
 * stable order. */
export function lintPaths(paths: string[], options?: LintOptions): LintFinding[] {
  const extensions = options?.extensions ?? DEFAULT_EXTENSIONS;
  const files: string[] = [];
  for (const p of paths) collectFiles(p, extensions, files);
  const disabled = disabledSet(options);
  const findings: LintFinding[] = [];
  for (const file of files) {
    try {
      const elements = normalize(readFileSync(file, 'utf8'), file);
      findings.push(...runRules(elements, disabled));
    } catch {
      // unreadable / unparseable file — skip, don't fabricate a finding
    }
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
  return findings;
}
