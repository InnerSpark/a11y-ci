# a11y-ci GitHub Action

Runs the a11y-ci engine on a pull request and posts a comment listing only the
accessibility issues the PR **introduces** (regression-only). Advisory by default;
opt into blocking with `fail-on`.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `base-url` | yes | — | Base-branch deployment URL (the comparison point). |
| `head-url` | yes | — | This PR's deployment/preview URL. |
| `routes` | no | `/` | Comma-separated paths checked on both URLs. |
| `fail-on` | no | `none` | `none` (advisory), `new-warn`, or `new-serious`. |
| `cli-version` | no | `latest` | Version of `@a11yci/cli`. |
| `github-token` | no | `github.token` | Token for posting the comment. |

## Permissions

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Behavior

1. Renders each route on `head-url` and `base-url` (Playwright + axe-core + checks).
2. Diffs them; keeps only issues new to the PR.
3. Upserts a single PR comment, worst-first by user impact.
4. Fails the job only if `fail-on` is set and matching regressions exist.

Everything runs inside your own CI runner. Nothing is uploaded anywhere.

See `../examples/workflow.yml` for a full example.
