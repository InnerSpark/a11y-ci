/** Public types for @a11yci/lint — the authoring-time static analyzer.
 *
 * This layer never renders the page. It reads source (JSX/TSX and HTML),
 * normalizes each element, and flags accessibility anti-patterns that are
 * confidently determinable from the markup alone. It is deliberately tuned for
 * a low false-positive rate: anything that genuinely needs the rendered DOM
 * (color contrast, computed roles) is left to the @a11yci/core engine. */

export type LintSeverity = 'error' | 'warn' | 'info';

export interface LintFinding {
  /** Stable rule id, e.g. "img-alt". */
  ruleId: string;
  severity: LintSeverity;
  /** Human-readable, actionable message. */
  message: string;
  /** e.g. "WCAG 1.1.1". */
  wcagRef?: string;
  /** Absolute or relative path of the source file. */
  file: string;
  /** 1-based line of the offending element. */
  line: number;
  /** 1-based column of the offending element. */
  column?: number;
  /** Short snippet of the opening tag, for context in reports. */
  snippet?: string;
}

/** An attribute value as seen in source:
 *  - string  → a literal value (`alt="logo"`, `tabindex="0"`)
 *  - true    → present with no value (`disabled`, `autofocus`)
 *  - null    → present but dynamic / unknown (`alt={x}`, `tabIndex={i}`) */
export type AttrValue = string | true | null;

/** A source element normalized across HTML and JSX into one shape the rules can
 * reason over without caring which language it came from. Attribute keys are
 * canonicalized to their HTML form (className→class, htmlFor→for, onClick→
 * onclick, tabIndex→tabindex, etc.) and lowercased. */
export interface NormalizedElement {
  /** Lowercase DOM tag name. JSX components (Uppercase / dotted) are skipped. */
  tag: string;
  attrs: Map<string, AttrValue>;
  /** Concatenated static text of direct children, trimmed. '' when none. */
  text: string;
  /** True if a dynamic expression child is present (e.g. `{label}`), which we
   * treat as "probably has text" to avoid false "empty control" findings. */
  hasDynamicText: boolean;
  /** Lowercase tags of direct child elements. */
  childTags: string[];
  /** True if this element is nested inside a <label> (implicit labelling). */
  inLabel: boolean;
  file: string;
  line: number;
  column: number;
  snippet: string;
}

export interface LintOptions {
  /** File extensions to consider when walking directories.
   * Defaults to ['.html', '.htm', '.jsx', '.tsx']. */
  extensions?: string[];
  /** Per-rule disables, keyed by rule id. */
  rules?: Record<string, { enabled?: boolean }>;
}
