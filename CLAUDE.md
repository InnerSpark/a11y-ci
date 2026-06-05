# a11y-ci: Claude instructions

Open-core accessibility CI tool. npm-workspaces monorepo with TypeScript project
references (`tsc -b`). Packages:

- `@a11yci/core` — render a URL with Playwright, run axe-core, return an AuditResult. Issue identity for the diff is a per-node content fingerprint (tag, computed role, accessible name, contrast colors), not the css selector.
- `@a11yci/diff` — regression-only diff. Compares multisets of node fingerprints per rule, so it catches new rules, higher counts, and same-count swaps while ignoring framework-hash churn.
- `@a11yci/lint` — static authoring linter for JSX/TSX + HTML source (parse5 + the TypeScript compiler, never regex).
- `@a11yci/llm` — optional BYO-key Claude adapter. Advisory only, never in the blocking gate.
- `@a11yci/cli` — `a11y-ci lint`, `audit`, `diff`.

Source-available under the Elastic License 2.0: free to use and self-host, not to resell as a hosted service.

## Build, test, release

- Build: `npm run build`. Test: `npm test` (builds, then `node --test`; the diff suite lives in `packages/diff/test`).
- Publishing is manual. Scoped packages need `publishConfig.access=public`; 2FA is a browser passkey flow (no `--otp`). Versions are immutable, so bump on any change.
- `main` is protected against force-push and deletion. Direct pushes are allowed.

## Writing Style

Applies to commit messages, release notes, README, GitHub issues, and any Slack or message draft written on Mike's behalf. Write like a person, not a machine.

- Never use the "it's not X, it's Y" antithesis, or its variants ("not just X but Y", "X isn't A, it's B"). This is the strongest LLM tell and gets recognized instantly. State the point directly. If you need a contrast, write it plainly rather than as a rhetorical flip.
- No em dashes. Use commas, parentheses, colons, or separate sentences.
- Avoid other AI tics: "Great question", "You're absolutely right", the words "genuinely" and "honestly", forced rule-of-three lists, and tidy summarizing closers.
- Plain and direct. If a sentence sounds like a template, rewrite it.

## Known limitations (state these honestly, never paper over)

- A render-once scan cannot observe time-based or periodic behavior (auto-logout, carousels, polling). Those are real barriers (WCAG 2.2.1 and friends) it will miss, so "catches what a PR introduces" describes a slice, not full coverage.
- The diff cannot judge severity by control importance. A swap onto a critical control surfaces as added but cannot be auto-ranked.
- Two nodes with identical content fingerprints cannot be told apart (see issue #6).
