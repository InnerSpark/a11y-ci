# @a11yci/cli

Command-line runner for [a11y-ci](https://github.com/InnerSpark/a11y-ci). Audit URLs
and diff base vs head into a ranked, regression-only PR comment.

```bash
# Audit a URL to a JSON result
npx @a11yci/cli audit https://example.com/checkout --out head.json

# Diff base vs head; advisory by default, opt into a gate with --fail-on
npx @a11yci/cli diff --base base.json --head head.json --format markdown
npx @a11yci/cli diff --base base.json --head head.json --fail-on new-serious
```

Reports only the accessibility issues a change introduces, ranked worst-first by
user impact. Anything the engine can't verify is labelled "needs review", never a
fabricated pass.

Source-available under the Elastic License 2.0 (see `LICENSE`): free to use and
self-host, not to resell as a hosted service.
