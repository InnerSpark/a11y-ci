# @a11yci/llm

Optional, bring-your-own-key Claude adapter for [a11y-ci](https://github.com/InnerSpark/a11y-ci).
It adds two advisory capabilities on top of the deterministic engine:

- **Fix suggestions** — a concrete, minimal fix for each detected issue.
- **Semantic review** — the issues automated checkers can't judge: unhelpful alt
  text, non-descriptive link text, label-in-name mismatches, sensory-only
  instructions.

Both are **advisory**. Suggestions are attached to issues for humans to review;
semantic findings are emitted at "manual" severity, so they can never flip the
deterministic pass/fail gate.

```ts
import { audit } from '@a11yci/core';
import { createAnthropicAdapter } from '@a11yci/llm';

const llm = createAnthropicAdapter(); // reads ANTHROPIC_API_KEY; returns null if absent
const result = await audit('https://example.com', { llm: llm ?? undefined });

if (llm?.suggestFix) {
  const fix = await llm.suggestFix(result.issues[0]);
}
```

Set `ANTHROPIC_API_KEY` in your environment. The key never leaves your machine /
CI runner; this package calls the Anthropic API directly and ships no telemetry.

Source-available under the Elastic License 2.0 (see `LICENSE`).
