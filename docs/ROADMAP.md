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

## Next — the authoring linter
- A static, source-level check (and a Claude skill) that catches issues as code is
  written, before it renders: the accessible-primitive nudges, JSX/template
  patterns, etc. This is the "shift-left" layer that pairs with the CI checker.
- `--fail-on` already gates on regressions; future work hardens the gate ergonomics
  (diff-aware route selection, baseline caching).

## Relationship to a hosted product
`@a11yci/core` + VPAT generation are designed to be the shared engine. A separate
hosted product can depend on these packages and add the system-of-record layer:
history, trends, VPAT archive, scheduled monitoring, teams/SSO. One engine, two
front doors.
