# a11y-ci

Catch the accessibility issues a pull request **introduces**, before they merge.

a11y-ci renders your app, runs a deterministic accessibility audit (axe-core plus
extra WCAG 2.2 checks), and compares the result against your base branch. It
reports only the issues your change **adds** — so you are never blocked by the
backlog of pre-existing debt, only by new regressions.

It is built to be **honest**: it reports what it actually measured, ranks findings
by real user impact, and never asserts a "pass" it did not verify. Anything that
needs a human is labelled, not hand-waved.

> Status: **v0** — deterministic engine, regression diff, and an advisory PR
> comment. No AI calls and no blocking gate yet (both are planned and designed to
> be opt-in). See `docs/ROADMAP.md`.

## Packages

| Package | What it does |
| --- | --- |
| `@a11yci/core` | Renders a URL and produces a structured `AuditResult` (axe + custom checks). |
| `@a11yci/diff` | Compares two `AuditResult`s into `{ added, fixed, unchanged }`. |
| `@a11yci/cli` | `a11y-ci` — audit a URL, or diff base vs head into a ranked Markdown comment. |
| `action/` | A GitHub Action that runs the CLI on a PR and posts the comment. |

## Quick start (local)

```bash
npm install
npm run build

# Audit one URL to a JSON result
npx a11y-ci audit https://staging.example.com/checkout --out head.json

# Audit the base build too, then diff
npx a11y-ci audit https://main.example.com/checkout --out base.json
npx a11y-ci diff --base base.json --head head.json --format markdown
```

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
      - uses: InnerSpark/a11y-ci/action@v0.1.1
        with:
          base-url: ${{ env.PREVIEW_BASE_URL }}     # base-branch deploy
          head-url: ${{ env.PREVIEW_HEAD_URL }}     # this PR's deploy
          routes: "/,/checkout,/account"            # or omit to use a sitemap
          fail-on: none                             # advisory; set 'new-serious' to block
```

It runs entirely inside your pipeline. Nothing is uploaded anywhere.

## Design principles

1. **Regression-only.** Gate on what the PR adds, never on the existing backlog.
2. **Deterministic core.** The blocking signal never depends on a model. (An
   optional AI layer for richer review + auto-fix is planned, and it will always
   be advisory, never in the blocking path.)
3. **Honest by default.** Measured fails are reported as fails; everything else is
   "needs review", never a fabricated pass.
4. **Rank by impact, not by clause number.** "A blind user cannot submit this
   form" outranks "page title is a little long."

## License

Source-available under the **Elastic License 2.0** (see `LICENSE`). Plain-English
summary, not a substitute for the license:

- ✅ Use it, run it in your own CI, modify it, self-host it internally — free.
- ✅ Drop it into your employer's pipeline — internal use is fully allowed.
- ❌ You may **not** offer it to third parties as a hosted or managed service
  (i.e. you can't repackage it and sell it as a competing product).

This is intentional: the tool is free for everyone to use, but not for anyone to
resell as a service.
