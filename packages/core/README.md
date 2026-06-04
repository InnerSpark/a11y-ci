# @a11yci/core

Deterministic accessibility audit engine. Renders a URL with Playwright, runs
axe-core plus extra WCAG 2.2 checks, and returns a structured `AuditResult`.

```ts
import { audit } from '@a11yci/core';

const result = await audit('https://example.com/checkout');
console.log(result.overallScore, result.issues.length);
```

Part of [a11y-ci](https://github.com/InnerSpark/a11y-ci). Source-available under the
Elastic License 2.0 (see `LICENSE`): free to use and self-host, not to resell as a
hosted service.
