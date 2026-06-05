# @a11yci/diff

Regression-only diff for accessibility audits. Given two `AuditResult`s (base and
head), returns `{ added, fixed, unchanged }` so CI gates only on the issues a
change **introduces** — not the pre-existing backlog. Normalizes volatile
framework class hashes so cosmetic churn isn't reported as a new issue.

Identity is **per node, by content fingerprint**, not by selector. axe reports one
issue per rule per page and its generated selector latches onto the volatile
Emotion/MUI `css-XXXX` class, so a selector-based comparison is blind to a
same-count *swap* (a removed offending node replaced by a different one). Instead
the engine fingerprints each node by stable content (tag, role, accessible name,
and rule-specific data such as a contrast color pair), and the diff compares the
multisets of those fingerprints per rule. So it catches new rules, higher counts,
*and* swaps, while still absorbing framework-hash churn. A head fingerprint base
did not have surfaces as an added entry marked `change: 'worsened'` (or `'new'` for
a wholly new rule), with `addedInstances` set; fewer instances is a partial fix and
is never gated. When an issue carries no `nodes` (older JSON), it falls back to the
normalized selector repeated by `instanceCount`.

Residual limit: two controls with identical content fingerprints are
indistinguishable, so swapping one identical-looking control for another reads as
unchanged.

```ts
import { diff, gatingRegressions } from '@a11yci/diff';

const d = diff(baseResult, headResult);
const blockers = gatingRegressions(d, 'fail'); // new fails only
```

Part of [a11y-ci](https://github.com/InnerSpark/a11y-ci). Source-available under the
Elastic License 2.0 (see `LICENSE`).
