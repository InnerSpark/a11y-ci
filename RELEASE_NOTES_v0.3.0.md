# a11y-ci v0.3.0: the authoring layer

v0.2 added the optional AI layer. v0.3 adds the other end of the pipeline: catching
accessibility problems while the code is being written, before anything renders.
a11y-ci now checks at two points and stays honest at both.

1. Authoring time: a static linter reads your source and flags anti-patterns.
2. Rendered CI: the existing engine renders the app and diffs against base.

## @a11yci/lint: the authoring linter

A new package and a new command, `a11y-ci lint`, that statically analyzes JSX/TSX
and HTML source. It never renders the page, so it is fast enough for the editor or
a pre-commit hook. It uses real parsers (parse5 for HTML, the TypeScript compiler
for JSX/TSX), never regex, which is what keeps the false-positive rate low.

```bash
npx a11y-ci lint src                 # walk a directory
npx a11y-ci lint src --format json   # machine-readable
npx a11y-ci lint src --fail-on warn  # advisory by default; opt into a gate
```

Nine rules to start: `img-alt`, `interactive-name`, `clickable-noninteractive`,
`input-label`, `positive-tabindex`, `vague-link-text`, `html-lang`, `no-autofocus`,
`obsolete-element`. It is conservative by design: a dynamic attribute (`alt={x}`,
`id={...}`) or an ambiguous child suppresses the rule rather than guess. Contrast
and computed-role checks are left to the rendered engine, which the linter does not
try to replicate.

Tested on real production source, not just fixtures. Running it across a 36-file
MUI React app surfaced a casing bug (component tags like `<Select>` were being
lowercased before the DOM-element check, so they were treated as raw `<select>`).
That is fixed: components are now correctly skipped, and statically `hidden`
elements are ignored. The same app comes back clean, as it should.

## Pre-commit hook (husky)

The repo ships a husky pre-commit hook (`.husky/pre-commit`) that runs the linter
on staged `.jsx`/`.tsx`/`.html` files and blocks the commit on errors. It is the
local twin of the CI check: deterministic, fast, no network, no API key. It
activates after `npm install` via the `prepare` script. The intentionally-broken
demo fixtures under `examples/` are excluded so they never block a commit.

## accessible-ui: the editor skill

A Claude skill (`skill/accessible-ui/`) that applies these same rules at authoring
time, with the judgment a static checker cannot do: whether alt text is actually
meaningful, whether an accessible name matches the visible label, whether the right
semantic element is used, whether focus is managed in a dialog. It writes UI
accessible by default and drives `a11y-ci lint` to verify, so issues are caught at
the keyboard rather than in CI.

## Count-aware regression diff (#4)

axe reports one issue per rule per page with an `instanceCount`. The diff compared
signatures as a set and ignored that count, so a PR that added more instances of a
rule the page already failed (same rule, first offending node unchanged) slipped
the gate. The diff is now count-aware: a head signature with more instances than
base surfaces the delta as an added "worsened" regression ("+N new instances of an
existing issue"), while pure framework-hash churn still reads as unchanged and a
lower count is treated as a partial fix. Reported by westont. Closed by #4.

## Docs and versioning

README gained a "two layers" overview, the linter usage and rule table, and the
pre-commit section. ROADMAP marks v0.3 shipped and lists the editor-integrated
skill as next. All packages bumped to 0.3.0.

## Action required

1. Build: `npm install && npm run build`.
2. Publish the packages (browser passkey auth, no `--otp`):
   `npm publish` in each of `packages/core`, `packages/diff`, `packages/llm`,
   `packages/lint`, `packages/cli` (publish `lint` before `cli`, which depends on
   it). `core`/`diff`/`llm` are unchanged in behavior but carry the 0.3.0 bump.
3. Tag the release: confirm the latest tag first (`gh release list --limit 1`),
   then `gh release create v0.3.0 --title "v0.3.0: the authoring layer" --notes-file RELEASE_NOTES_v0.3.0.md --latest`.
