# a11y-ci

Catch the accessibility issues a pull request **introduces**, before they merge.

a11y-ci renders your app, runs a deterministic accessibility audit (axe-core plus
extra WCAG 2.2 checks), and compares the result against your base branch. It
reports only the issues your change **adds** — so you are never blocked by the
backlog of pre-existing debt, only by new regressions.

It is built to be **honest**: it reports what it actually measured, ranks findings
by real user impact, and never asserts a "pass" it did not verify. Anything that
needs a human is labelled, not hand-waved.

> Status: **v0.5**. Deterministic rendered engine, a content-fingerprint
> regression diff (now keyed on the browser's computed accessible name and
> colors), an advisory PR comment, an optional (opt-in) AI layer, and a static
> authoring linter for source. Blocking is opt-in via `--fail-on`. See
> `docs/ROADMAP.md`.

a11y-ci is the open-source, PR-diff piece of a bigger picture. For a hosted version
with a dashboard, whole-site crawling, authenticated-page scanning, score tracking
over time, and VPAT/ACR export, see [AccessSpark](https://accessspark.io), a hosted
web accessibility auditor from the same author.

## Two layers, one principle

a11y-ci checks accessibility at two points, and is honest at both:

1. **Authoring time** — `@a11yci/lint` reads your JSX/TSX and HTML **source** and
   flags anti-patterns before anything renders (the clickable `<div>`, the `<img>`
   with no alt, a positive `tabindex`). Fast, runs in the editor or pre-commit.
2. **Rendered CI** — `@a11yci/core` renders the app and runs axe-core plus extra
   WCAG 2.2 checks, then diffs against your base branch so only **new** issues are
   reported. This is where contrast and computed-role checks live.

The linter never guesses at what needs the live DOM, and the engine never claims a
pass it didn't measure.

## Packages

| Package | What it does |
| --- | --- |
| `@a11yci/lint` | Static authoring linter: flags a11y anti-patterns in JSX/TSX + HTML source, no render. |
| `@a11yci/core` | Renders a URL and produces a structured `AuditResult` (axe + custom checks). |
| `@a11yci/diff` | Compares two `AuditResult`s into `{ added, fixed, unchanged }`. |
| `@a11yci/llm` | Optional, BYO-key Claude adapter: AI fix suggestions + semantic review. Advisory. |
| `@a11yci/cli` | `a11y-ci` — lint source, audit a URL, or diff base vs head into a ranked comment. |
| `action/` | A GitHub Action that runs the CLI on a PR and posts the comment. |

## Quick start (local)

```bash
npm install
npm run build

# Lint source for accessibility anti-patterns (no render)
npx a11y-ci lint src

# Audit one URL to a JSON result
npx a11y-ci audit https://staging.example.com/checkout --out head.json

# Audit the base build too, then diff
npx a11y-ci audit https://main.example.com/checkout --out base.json
npx a11y-ci diff --base base.json --head head.json --format markdown
```

## Authoring linter (`a11y-ci lint`)

Static analysis of JSX/TSX and HTML source — it never renders the page, so it's
fast enough for the editor or a pre-commit hook. It uses real parsers (parse5 for
HTML, the TypeScript compiler for JSX/TSX), never regex, which is what keeps the
false-positive rate low.

```bash
npx a11y-ci lint src                # walk a directory
npx a11y-ci lint src --format json  # machine-readable
npx a11y-ci lint src --fail-on warn # exit non-zero on warn-or-worse (advisory by default)
```

| Rule | Severity | WCAG | Catches |
| --- | --- | --- | --- |
| `img-alt` | error | 1.1.1 | `<img>` with no `alt` (and not marked decorative) |
| `interactive-name` | error | 4.1.2 | `<button>` / `<a href>` with no text or accessible name |
| `clickable-noninteractive` | warn | 2.1.1 | `<div>`/`<span>` with `onClick` but no role, tabindex, or key handler |
| `input-label` | warn | 1.3.1 | form control with no `id`, no `aria-label`, and not wrapped in a `<label>` |
| `positive-tabindex` | warn | 2.4.3 | `tabindex` greater than 0 |
| `vague-link-text` | warn | 2.4.4 | link text like "click here" / "read more" |
| `html-lang` | error | 3.1.1 | `<html>` with no `lang` |
| `no-autofocus` | info | 3.2.1 | `autofocus` (moves focus on load) |
| `obsolete-element` | error | 2.2.2 | `<marquee>` / `<blink>` |

It's deliberately conservative: a dynamic attribute (`alt={x}`, `id={...}`) or an
ambiguous child suppresses the related rule rather than guess. Contrast and
computed-role checks are left to the rendered engine, which the linter never tries
to replicate. See `examples/demo/Signup.tsx` for a fixture showing each rule (and
the matching "good" cases it stays silent on).

### Pre-commit hook

This repo ships a husky pre-commit hook (`.husky/pre-commit`) that runs the linter
on staged `.jsx`/`.tsx`/`.html` files and blocks the commit on errors. It's the
local twin of the CI check: deterministic, ~0.6s, no network, no API key. The
thing that can stop a commit is always the deterministic linter, never the AI
layer, for the same reason the CI gate never depends on a model.

It activates automatically after `npm install` (via the `prepare` script). To add
the same gate to your own project:

```bash
npm install --save-dev husky
npx husky init
```

```sh
# .husky/pre-commit
staged=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(jsx|tsx|html?)$')
[ -z "$staged" ] && exit 0
npx a11y-ci lint $staged --fail-on error   # tighten to --fail-on warn once trusted
```

Errors block (missing alt, empty controls); warnings pass until you're ready to
tighten the gate.

## In CI (advisory)

```yaml
# .github/workflows/a11y.yml
name: a11y-ci
on: pull_request
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: InnerSpark/a11y-ci/action@v0.3.0
        with:
          base-url: ${{ env.PREVIEW_BASE_URL }}     # base-branch deploy
          head-url: ${{ env.PREVIEW_HEAD_URL }}     # this PR's deploy
          routes: "/,/checkout,/account"            # or omit to use a sitemap
          fail-on: none                             # advisory; set 'new-serious' to block
```

It runs entirely inside your pipeline. Nothing is uploaded anywhere.

## AI fix suggestions (optional, bring-your-own-key)

Add Claude-generated fix suggestions to the new issues, and a semantic review of
the things axe can't judge. Both are **advisory** and never change the pass/fail
decision. Set `ANTHROPIC_API_KEY` and:

```bash
a11y-ci diff --base base.json --head head.json --suggest-fixes   # adds a fix to each new issue
a11y-ci audit https://example.com --semantic                     # adds AI-found semantic issues
```

In the Action:

```yaml
- uses: InnerSpark/a11y-ci/action@v0.3.0
  with:
    base-url: ${{ env.PREVIEW_BASE_URL }}
    head-url: ${{ env.PREVIEW_HEAD_URL }}
    suggest-fixes: "true"
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

The key is only read for these features, stays in your runner, and is never logged.
With no key, everything falls back to the deterministic-only behavior.

## Design principles

1. **Regression-only.** Gate on what the PR adds, never on the existing backlog.
2. **Deterministic core.** The blocking signal never depends on a model. (An
   optional AI layer for richer review + auto-fix is planned, and it will always
   be advisory, never in the blocking path.)
3. **Honest by default.** Measured fails are reported as fails; everything else is
   "needs review", never a fabricated pass.
4. **Rank by impact, not by clause number.** "A blind user cannot submit this
   form" outranks "page title is a little long."

## Known limitations

Automated regression checking catches a slice of accessibility, not the whole
picture. Being honest about the gaps is part of the point. Thanks to the web-a11y
community (westont of Assistiv Labs, autosponge) for stress-testing these.

- **Time-based and periodic behavior is invisible.** The engine renders the page
  once and scans that snapshot, so anything that only happens over time or on a
  schedule with no user action (a session that auto-logs-out, an auto-advancing
  carousel, a toast that auto-dismisses, polling that swaps content) is never
  observed. These are real barriers (WCAG 2.2.1 and friends) that a PR can
  introduce while the diff still reports "no new issues."
- **The gate can't judge severity by importance.** Identity is per node, so a swap
  that moves an existing low-priority issue onto a critical control (a nameless
  icon button that becomes the "Add to cart" button) is surfaced as *added*, but
  the tool can't know it is now business-critical. Treat added items as needing a
  human's severity call, not an automatic ranking.
- **Indistinguishable nodes can't be told apart.** When two elements have the same
  content fingerprint (no name, no text, same role), a swap between them reads as
  unchanged. See the diff package and issue #6.
- **Accessible-name fidelity depends on the browser.** The engine reads Chrome's
  computed accessible name via `getComputedAccessibleNode` when available, and
  falls back to a heuristic otherwise; headless builds without the
  AccessibilityObjectModel feature use the heuristic.

## License

Source-available under the **Elastic License 2.0** (see `LICENSE`). Plain-English
summary, not a substitute for the license:

- ✅ Use it, run it in your own CI, modify it, self-host it internally — free.
- ✅ Drop it into your employer's pipeline — internal use is fully allowed.
- ❌ You may **not** offer it to third parties as a hosted or managed service
  (i.e. you can't repackage it and sell it as a competing product).

This is intentional: the tool is free for everyone to use, but not for anyone to
resell as a service.

