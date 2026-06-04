# @a11yci/diff

Regression-only diff for accessibility audits. Given two `AuditResult`s (base and
head), returns `{ added, fixed, unchanged }` so CI gates only on the issues a
change **introduces** — not the pre-existing backlog. Normalizes volatile
framework class hashes so cosmetic churn isn't reported as a new issue.

```ts
import { diff, gatingRegressions } from '@a11yci/diff';

const d = diff(baseResult, headResult);
const blockers = gatingRegressions(d, 'fail'); // new fails only
```

Part of [a11y-ci](https://github.com/InnerSpark/a11y-ci). Source-available under the
Elastic License 2.0 (see `LICENSE`).
