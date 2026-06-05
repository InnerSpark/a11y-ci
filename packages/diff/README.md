# @a11yci/diff

Regression-only diff for accessibility audits. Given two `AuditResult`s (base and
head), returns `{ added, fixed, unchanged }` so CI gates only on the issues a
change **introduces** — not the pre-existing backlog. Normalizes volatile
framework class hashes so cosmetic churn isn't reported as a new issue.

It's also **count-aware**. axe reports one issue per rule per page (with an
`instanceCount`), so comparing signatures alone would miss a PR that adds *more*
instances of a rule the page already fails. When head has more instances of an
existing signature than base, the diff surfaces the delta as an added entry marked
`change: 'worsened'` (with `addedInstances` set), so "3 new contrast failures of a
kind already present" still gates. Fewer instances than base is a partial fix and
is never gated.

```ts
import { diff, gatingRegressions } from '@a11yci/diff';

const d = diff(baseResult, headResult);
const blockers = gatingRegressions(d, 'fail'); // new fails only
```

Part of [a11y-ci](https://github.com/InnerSpark/a11y-ci). Source-available under the
Elastic License 2.0 (see `LICENSE`).
