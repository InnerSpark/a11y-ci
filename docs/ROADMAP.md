# Roadmap

## v0 (this scaffold) — deterministic, advisory
- `@a11yci/core`: render a URL with Playwright, run axe-core + custom checks, return `AuditResult`.
- `@a11yci/diff`: regression diff (added / fixed / unchanged).
- `@a11yci/cli`: `audit` and `diff` commands; ranked Markdown PR comment.
- GitHub Action: run on PR, post advisory comment. No blocking, no AI.

## v0.x — port the deeper checks
- Bring over additional custom WCAG 2.2 checks (gradient-aware contrast,
  keyboard-trap, focus-not-obscured with overlay-skip, reflow, text spacing,
  target size), each with the false-positive guards already learned
  (skip aria-hidden, skip disabled controls, skip chart-library tooltips, cross-
  validate axe color-contrast against computed colors).
- Diff-aware route selection from the PR diff so CI stays fast.

## v0.2 — optional AI layer (shipped)
- `@a11yci/llm`: a bring-your-own-key Claude adapter, kept strictly advisory.
- `a11y-ci diff --suggest-fixes` attaches an AI fix suggestion to each new issue.
- `a11y-ci audit --semantic` adds the checks axe can't judge (unhelpful alt text,
  non-descriptive link text, label-in-name, sensory-only instructions) at "manual"
  severity. Neither path can ever change the deterministic pass/fail decision.

## v0.3 — the authoring linter (shipped)
- `@a11yci/lint`: a static, source-level check that catches issues as code is
  written, before it renders. The "shift-left" layer that pairs with the rendered
  CI checker. Real parsers, never regex: parse5 for HTML, the TypeScript compiler
  for JSX/TSX.
- `a11y-ci lint <path...>` walks files/directories and reports findings, with an
  opt-in `--fail-on warn|error` gate. Nine rules to start: `img-alt`,
  `interactive-name`, `clickable-noninteractive`, `input-label`,
  `positive-tabindex`, `vague-link-text`, `html-lang`, `no-autofocus`,
  `obsolete-element`.
- Conservative by design: a dynamic attribute or ambiguous child suppresses the
  rule rather than guess. Contrast and computed-role checks stay with the rendered
  engine, which the linter never tries to replicate.

## Next
- A Claude skill that applies these same rules at authoring time inside the editor,
  so the fix is suggested as the code is written (the linter is the engine it
  references).
- Grow the rule set (heading order, redundant alt, duplicate ids, label-in-name
  from source) as real-world false-positive data comes in.
- `--fail-on` already gates on regressions; future work hardens the gate ergonomics
  (diff-aware route selection, baseline caching).

## Relationship to a hosted product
`@a11yci/core` + VPAT generation are designed to be the shared engine. A separate
hosted product can depend on these packages and add the system-of-record layer:
history, trends, VPAT archive, scheduled monitoring, teams/SSO. One engine, two
front doors.
