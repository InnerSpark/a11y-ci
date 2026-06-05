# @a11yci/lint

The authoring-time layer of [a11y-ci](https://github.com/InnerSpark/a11y-ci).
It reads your source (JSX/TSX and HTML) and flags accessibility anti-patterns
**before anything renders**, so they're caught in the editor or pre-commit
instead of in a rendered CI run.

It uses real parsers, never regex: parse5 for HTML, the TypeScript compiler for
JSX/TSX. That's what keeps the false-positive rate low. It only reports what it
can confidently determine from the markup, and leaves contrast and computed-role
checks to the rendered `@a11yci/core` engine.

```ts
import { lintPaths, lintSource } from '@a11yci/lint';

const findings = lintPaths(['src']);            // walk a directory
const inline = lintSource('<img src="a.png">', 'a.html'); // one snippet
```

## Rules

| Rule | Severity | WCAG | Catches |
| --- | --- | --- | --- |
| `img-alt` | error | 1.1.1 | `<img>` with no `alt` (and not marked decorative) |
| `interactive-name` | error | 4.1.2 | `<button>` / `<a href>` with no text or accessible name |
| `clickable-noninteractive` | warn | 2.1.1 | `<div>`/`<span>` with `onClick` but no role, tabindex, or key handler |
| `input-label` | warn | 1.3.1 | form control with no `id`, no `aria-label`, and not wrapped in a `<label>` |
| `positive-tabindex` | warn | 2.4.3 | `tabindex` greater than 0 |
| `vague-link-text` | warn | 2.4.4 | link text like "click here" / "read more" |
| `html-lang` | error | 3.1.1 | `<html>` with no `lang` |
| `no-autofocus` | info | 3.2.1 | `autofocus` (moves focus on load) |
| `obsolete-element` | error | 2.2.2 | `<marquee>` / `<blink>` |

Conservative by design: a dynamic attribute (`alt={x}`, `id={...}`) or an
ambiguous child suppresses the related rule rather than guessing.

## CLI

```bash
npx a11y-ci lint src
npx a11y-ci lint src --format json
npx a11y-ci lint src --fail-on warn   # exit non-zero on warn-or-worse
```

Source-available under the Elastic License 2.0 (see `LICENSE`): free to use and
self-host, not to resell as a hosted service.
