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

## v1 — opt-in gate + optional AI layer
- `--fail-on=new-serious|new-any` to block merges on regressions (opt-in).
- Optional `LlmAdapter` (bring-your-own key): semantic review (alt-text quality,
  label-in-name, reading-order intent) as advisory comments, plus suggested-change
  auto-fixes. Never in the blocking path.

## Relationship to a hosted product
`@a11yci/core` + VPAT generation are designed to be the shared engine. A separate
hosted product can depend on these packages and add the system-of-record layer:
history, trends, VPAT archive, scheduled monitoring, teams/SSO. One engine, two
front doors.
