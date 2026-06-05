# The deterministic rules, with fixes

These are the nine checks `a11y-ci lint` runs on source. Each is something you can
get right while writing. The "why" matters more than the rule: if you understand
who is hurt and how, you'll apply it correctly in situations no rule list anticipated.

## Contents
1. img-alt
2. interactive-name
3. clickable-noninteractive
4. input-label
5. positive-tabindex
6. vague-link-text
7. html-lang
8. no-autofocus
9. obsolete-element
10. How to run and read the linter

---

## 1. img-alt — every image needs alt text (WCAG 1.1.1)

A screen reader announces an image by its `alt`. With no `alt`, many readers fall
back to reading the file name ("IMG_4021.png"), which is noise. With `alt=""`, the
reader skips it, which is exactly right for decoration.

```jsx
// ✗ no alt — reader announces the filename or nothing useful
<img src="/logo.png" />

// ✓ meaningful image: describe its content/purpose
<img src="/logo.png" alt="Acme — back to home" />

// ✓ decorative image: empty alt so it's skipped
<img src="/divider.svg" alt="" />
```

Don't write `alt="image"` or `alt="logo"` — that's noise dressed up as a label.
Describe what the image *communicates* in context.

## 2. interactive-name — controls need an accessible name (WCAG 4.1.2)

A `<button>` or `<a href>` with no text and no `aria-label` is an unlabeled control:
the reader announces "button" with no idea what it does.

```jsx
// ✗ icon-only button with no name
<button onClick={close}><XIcon /></button>

// ✓ name says what it does (not what it looks like — "Close", not "X")
<button onClick={close} aria-label="Close dialog"><XIcon aria-hidden="true" /></button>

// ✓ a button with visible text is already named — nothing to add
<button onClick={save}>Save changes</button>
```

## 3. clickable-noninteractive — don't fake a control with a div (WCAG 2.1.1)

`onClick` on a `<div>`/`<span>` is invisible to the keyboard and the accessibility
tree: it isn't focusable, Enter/Space won't fire it, and it has no role. People
"fix" this by bolting on `role`, `tabindex`, and key handlers — which is just
rebuilding a button badly.

```jsx
// ✗ a div pretending to be a button
<div onClick={openMenu}>Menu</div>

// ✓ use the real element — focus, keyboard, and role come for free
<button onClick={openMenu}>Menu</button>

// ✓ only if you truly can't use <button>: rebuild ALL of it
<div role="button" tabIndex={0} onClick={openMenu}
     onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openMenu()}>
  Menu
</div>
```

Reach for the native element first, every time. The custom version is a last resort.

## 4. input-label — every field has a programmatic label (WCAG 1.3.1)

A label is what tells the screen-reader user what to type, and it's the click target
that focuses the field. A placeholder is neither — it disappears on input and is
inconsistently exposed.

```jsx
// ✗ placeholder is not a label
<input type="email" placeholder="Email address" />

// ✓ wrap it (implicit label) — no id needed
<label>Email address <input type="email" /></label>

// ✓ or associate by id (explicit label)
<label htmlFor="email">Email address</label>
<input id="email" type="email" />

// ✓ component library: use its labeling API
<TextField label="Email address" type="email" />
```

The linter only flags raw `<input>/<select>/<textarea>`; it leaves components alone
because it can't see inside them. The requirement is the same either way.

## 5. positive-tabindex — never reorder the tab sequence (WCAG 2.4.3)

`tabIndex={0}` = focusable in natural order. `tabIndex={-1}` = focusable only via
script (for focus management). Any positive number yanks the element to the front of
the global tab order and is a maintenance trap.

```jsx
<nav tabIndex={2}>…</nav>   // ✗ breaks the natural order
<nav>…</nav>                 // ✓ let the DOM order stand
<div tabIndex={-1} ref={dialogRef}>…</div>  // ✓ programmatic focus target
```

## 6. vague-link-text — link text must stand alone (WCAG 2.4.4)

Screen-reader users often pull up a list of just the links. "Click here" ×8 tells
them nothing. The link text should describe the destination on its own.

```jsx
<a href="/pricing">click here</a>            // ✗
<a href="/pricing">See our pricing plans</a> // ✓
```

## 7. html-lang — declare the document language (WCAG 3.1.1)

Without `lang`, a screen reader may read content in the wrong accent/voice, mangling
pronunciation. One attribute fixes it.

```html
<html lang="en">
```

## 8. no-autofocus — don't move focus on load without reason (WCAG 3.2.1, advisory)

`autofocus` yanks focus on load. For a keyboard or screen-reader user this can skip
past your heading and context and dump them mid-page, disoriented. Sometimes it's
right (a search-first page, the first field of a one-purpose modal) — so this is
`info`, not an error. Confirm it's intentional.

## 9. obsolete-element — no `<marquee>` / `<blink>` (WCAG 2.2.2)

Moving, unstoppable content fails "pause, stop, hide" and is unreadable for many.
If you need motion, make it pausable and honor `prefers-reduced-motion`.

---

## 10. How to run and read the linter

```bash
npx a11y-ci lint src                 # a directory
npx a11y-ci lint src/Foo.tsx a.html  # specific files
npx a11y-ci lint src --format json   # machine-readable
npx a11y-ci lint src --fail-on error # exit non-zero on errors (for hooks/CI)
```

Output is `file → line:col severity message [rule-id]`. Severities: `error` (a
real barrier — fix it), `warn` (very likely a problem — fix unless you can justify
it), `info` (worth a glance). After a UI change, lint the files you touched and
clear what it finds before moving on.

A finding you believe is wrong is worth a second look first — the linter is tuned to
be quiet and rarely false-positives. If it genuinely is (e.g. a dynamic value it
can't resolve), that's fine; the rendered CI check is the backstop.
