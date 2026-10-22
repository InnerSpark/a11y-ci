# a11y-ci v0.5.1: action runs on Node 22

Maintenance release for the GitHub Action. No engine, diff, lint, or CLI changes.

- **The composite action now sets up Node 22** instead of Node 20. Node shipped
  security fixes on Oct 21, 2026 (10 CVEs, including a Brotli decoder RCE), and
  Node 20 is end-of-life with no fix. The selftest workflow runs on 22 too.
- **No npm publish.** The action still installs `@a11yci/cli@latest` (or your
  `cli-version`), and the packages stay at 0.5.0.

To pick it up, bump your workflow to `InnerSpark/a11y-ci/action@v0.5.1`.
