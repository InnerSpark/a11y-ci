/** The rule set. Each rule inspects one NormalizedElement and returns zero or
 * more findings. Rules are intentionally conservative: when the source is
 * ambiguous (a dynamic attribute, a child we can't resolve), they stay silent
 * rather than guess. The rendered @a11yci/core engine is the backstop for
 * anything that needs the live DOM. */

import type { AttrValue, LintFinding, NormalizedElement } from './types.js';

type Rule = (el: NormalizedElement) => LintFinding[] | LintFinding | null;

function has(el: NormalizedElement, name: string): boolean {
  return el.attrs.has(name);
}
function val(el: NormalizedElement, name: string): AttrValue | undefined {
  return el.attrs.get(name);
}
function str(el: NormalizedElement, name: string): string | undefined {
  const v = el.attrs.get(name);
  return typeof v === 'string' ? v : undefined;
}
function finding(el: NormalizedElement, ruleId: string, severity: LintFinding['severity'], message: string, wcagRef?: string): LintFinding {
  return { ruleId, severity, message, wcagRef, file: el.file, line: el.line, column: el.column, snippet: el.snippet };
}

const INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'checkbox', 'radio', 'switch', 'option', 'slider', 'spinbutton', 'textbox']);
const LABELABLE = new Set(['input', 'select', 'textarea']);
const NO_LABEL_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
const VAGUE_LINK_TEXT = new Set(['click here', 'click', 'here', 'read more', 'more', 'learn more', 'this link', 'link', 'details', 'read', 'go', 'continue']);

/** 1.1.1 — <img> needs alt (or be explicitly decorative). */
const imgAlt: Rule = (el) => {
  if (el.tag !== 'img') return null;
  if (has(el, 'alt')) return null;
  if (str(el, 'role') === 'presentation' || str(el, 'role') === 'none') return null;
  if (str(el, 'aria-hidden') === 'true') return null;
  return finding(el, 'img-alt', 'error', '<img> has no alt attribute. Add descriptive alt text, or alt="" if the image is purely decorative.', 'WCAG 1.1.1');
};

/** 4.1.2 — a control with no text and no accessible name is unusable. */
const interactiveName: Rule = (el) => {
  const isButton = el.tag === 'button';
  const isLink = el.tag === 'a' && has(el, 'href');
  if (!isButton && !isLink) return null;
  const named = has(el, 'aria-label') || has(el, 'aria-labelledby') || has(el, 'title');
  const emptyOfText = el.text === '' && !el.hasDynamicText;
  // Lenient: only flag when there is genuinely no text AND no child elements
  // (a child <img>/<svg> may carry the name; we can't resolve that statically).
  if (emptyOfText && el.childTags.length === 0 && !named) {
    const what = isButton ? '<button>' : '<a>';
    return finding(el, 'interactive-name', 'error', `${what} has no text or accessible name. Add visible text, or an aria-label.`, 'WCAG 4.1.2');
  }
  return null;
};

/** 2.1.1 / 4.1.2 — a clickable <div>/<span> that isn't a real control. */
const clickableNoninteractive: Rule = (el) => {
  if (el.tag !== 'div' && el.tag !== 'span') return null;
  if (!has(el, 'onclick')) return null;
  const role = str(el, 'role');
  const hasInteractiveRole = role !== undefined && INTERACTIVE_ROLES.has(role);
  const hasKey = has(el, 'onkeydown') || has(el, 'onkeyup') || has(el, 'onkeypress');
  const hasTabindex = has(el, 'tabindex');
  if (hasInteractiveRole && hasKey && hasTabindex) return null; // a properly-built custom control
  const missing: string[] = [];
  if (!hasInteractiveRole) missing.push('a role (e.g. role="button")');
  if (!hasTabindex) missing.push('tabindex="0"');
  if (!hasKey) missing.push('a keyboard handler (onKeyDown)');
  return finding(
    el,
    'clickable-noninteractive',
    'warn',
    `<${el.tag}> has an onClick but is not keyboard-operable. Use a <button>, or add ${missing.join(', ')}.`,
    'WCAG 2.1.1',
  );
};

/** 2.4.3 — positive tabindex breaks the natural focus order. */
const positiveTabindex: Rule = (el) => {
  const t = str(el, 'tabindex');
  if (t === undefined) return null;
  const n = Number(t);
  if (Number.isFinite(n) && n > 0) {
    return finding(el, 'positive-tabindex', 'warn', `tabindex="${t}" forces a manual focus order and is fragile. Use 0 (focusable, natural order) or -1 (programmatic only).`, 'WCAG 2.4.3');
  }
  return null;
};

/** 3.1.1 — the document needs a language. */
const htmlLang: Rule = (el) => {
  if (el.tag !== 'html') return null;
  if (has(el, 'lang')) return null;
  return finding(el, 'html-lang', 'error', '<html> is missing a lang attribute (e.g. lang="en"). Screen readers need it to choose a voice.', 'WCAG 3.1.1');
};

/** 3.2.1 (best practice) — autofocus can disorient AT users. */
const noAutofocus: Rule = (el) => {
  if (!has(el, 'autofocus')) return null;
  return finding(el, 'no-autofocus', 'info', `${'<' + el.tag + '>'} uses autofocus, which moves focus on load and can disorient screen-reader and keyboard users. Confirm it is intentional.`, 'WCAG 3.2.1');
};

/** 2.4.4 — link text must make sense out of context. */
const vagueLinkText: Rule = (el) => {
  if (el.tag !== 'a') return null;
  if (!el.text) return null;
  const norm = el.text.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!:»>→]+$/, '').trim();
  if (VAGUE_LINK_TEXT.has(norm)) {
    return finding(el, 'vague-link-text', 'warn', `Link text "${el.text.trim()}" is not descriptive on its own. Use text that says where the link goes.`, 'WCAG 2.4.4');
  }
  return null;
};

/** 4.1.1 (best practice) — obsolete, inaccessible elements. */
const obsoleteElement: Rule = (el) => {
  if (el.tag === 'marquee' || el.tag === 'blink') {
    return finding(el, 'obsolete-element', 'error', `<${el.tag}> is obsolete and inaccessible (moving content, no controls). Remove it; if motion is needed, make it pausable and respect prefers-reduced-motion.`, 'WCAG 2.2.2');
  }
  return null;
};

/** 1.3.1 / 4.1.2 — a form control that appears to have no label.
 * Conservative: only fires when there is no id (so no <label for> can target
 * it), no aria-label/labelledby/title, it is not wrapped in a <label>, and the
 * type is one that needs a label. A dynamic id (id={...}) suppresses this. */
const inputLabel: Rule = (el) => {
  if (!LABELABLE.has(el.tag)) return null;
  if (el.tag === 'input') {
    const type = str(el, 'type');
    if (type !== undefined && NO_LABEL_INPUT_TYPES.has(type)) return null;
  }
  if (el.inLabel) return null;
  if (has(el, 'id')) return null; // may be targeted by a <label for> elsewhere
  if (has(el, 'aria-label') || has(el, 'aria-labelledby') || has(el, 'title')) return null;
  return finding(el, 'input-label', 'warn', `<${el.tag}> has no associated label. Wrap it in a <label>, add a <label for> with a matching id, or set aria-label.`, 'WCAG 1.3.1');
};

const RULES: Rule[] = [
  imgAlt,
  interactiveName,
  clickableNoninteractive,
  positiveTabindex,
  htmlLang,
  noAutofocus,
  vagueLinkText,
  obsoleteElement,
  inputLabel,
];

/** All rule ids, for documentation / config validation. */
export const RULE_IDS = ['img-alt', 'interactive-name', 'clickable-noninteractive', 'positive-tabindex', 'html-lang', 'no-autofocus', 'vague-link-text', 'obsolete-element', 'input-label'] as const;

export function runRules(elements: NormalizedElement[], disabled: Set<string>): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const el of elements) {
    // A statically `hidden` element is not in the accessibility tree, so none
    // of these rules apply to it (e.g. a visually-hidden file input driven by a
    // custom button, which carries the accessible name).
    if (el.attrs.get('hidden') === true) continue;
    for (const rule of RULES) {
      const r = rule(el);
      if (!r) continue;
      const list = Array.isArray(r) ? r : [r];
      for (const f of list) {
        if (disabled.has(f.ruleId)) continue;
        findings.push(f);
      }
    }
  }
  // Stable order: by file, then line, then column.
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
  return findings;
}
