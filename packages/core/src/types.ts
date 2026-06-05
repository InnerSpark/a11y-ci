/** Public types for @a11yci/core. Shaped so a host application and this engine
 * can converge on a single shared audit format. */

export type Severity = 'fail' | 'warn' | 'manual' | 'info' | 'pass';

export type WcagLevel = 'A' | 'AA' | 'AAA';

/** One offending node within an issue. The `fingerprint` is what the diff uses
 * for identity: a stable, content-derived signature (tag, role, accessible name,
 * and rule-specific data such as a contrast color pair) that deliberately does
 * NOT include the volatile css-class selector. Two genuinely different elements
 * (a link vs a button) get different fingerprints, so a same-count swap is
 * visible to the diff. `target` is the raw axe selector, kept only for display. */
export interface IssueNode {
  fingerprint: string;
  target?: string;
}

export interface Issue {
  /** Stable identifier for the rule, e.g. "axe-color-contrast". Used by the diff
   * to decide whether two issues are "the same" across base and head. */
  id: string;
  severity: Severity;
  title: string;
  description: string;
  /** Concrete remediation guidance. */
  fix?: string;
  /** e.g. "WCAG 1.4.3" */
  wcagRef?: string;
  wcagLevel?: WcagLevel;
  /** CSS selector or short HTML snippet of the first offending node. */
  element?: string;
  /** axe impact, when available: "critical" | "serious" | "moderate" | "minor". */
  impact?: string;
  /** How many nodes matched this rule on the page. */
  instanceCount?: number;
  /** Content fingerprints for every offending node, used by the diff for
   * instance-level identity. When present the diff compares these multisets;
   * when absent it falls back to the normalized selector + instanceCount. */
  nodes?: IssueNode[];
  /** Optional AI-suggested fix, attached by the @a11yci/llm adapter. Advisory. */
  aiFix?: string;
}

export interface PageResult {
  url: string;
  /** 0-100, higher is better. */
  score: number;
  issues: Issue[];
  /** "playwright" today; "static" reserved for an HTML-only path. */
  renderMode: 'playwright' | 'static';
  /** Set when the page could not be rendered/audited. The page is then reported
   * as an error rather than silently scored 100. */
  error?: string;
}

export interface AuditResult {
  /** ISO timestamp of the run. */
  timestamp: string;
  /** Per-page results. A single-URL audit has one entry. */
  pages: PageResult[];
  /** All issues across all pages, flattened (convenience for the diff). */
  issues: Issue[];
  /** Average page score, 0-100. */
  overallScore: number;
}

/** Optional, injected. The deterministic engine never requires this; when
 * provided, callers (CLI, Action, or a host application) can layer semantic
 * review and auto-fix on top. Bring-your-own key — no model or secret lives in
 * the engine. */
export interface LlmAdapter {
  semanticReview?(input: { url: string; html: string }): Promise<Issue[]>;
  suggestFix?(issue: Issue, context?: { html?: string }): Promise<string | null>;
}

export interface AuditOptions {
  /** Reserved; only "playwright" is implemented in v0. */
  render?: 'playwright' | 'static';
  /** Per-rule severity overrides / disables, keyed by issue id. */
  rules?: Record<string, { severity?: Severity; enabled?: boolean }>;
  /** Use the real Chrome channel for accurate rendering when available. */
  useChromeChannel?: boolean;
  /** Navigation timeout (ms). */
  timeoutMs?: number;
  /** Optional, advisory-only. Never affects deterministic scoring. */
  llm?: LlmAdapter;
}
