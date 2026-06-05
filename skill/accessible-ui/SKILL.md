---
name: accessible-ui
description: Write and edit user-facing UI so it is accessible by default (WCAG 2.2 AA). Use this skill whenever creating or modifying UI markup or components — React/JSX/TSX, HTML, Vue or Svelte templates — including buttons, links, forms and inputs, images and icons, modals and dialogs, menus, tabs, cards, and navigation. Trigger even when the user does not say "accessibility": any time you are authoring interactive UI, building a component or a form or a page layout, or wiring up click handlers, apply this skill so the markup is born accessible and gets linted before it ships. Pairs with the a11y-ci linter (`a11y-ci lint`) for a deterministic source-level check.
---

# Accessible UI by default

The goal is simple: the UI you write should be usable by someone navigating with a
keyboard and a screen reader, on the first try, without anyone having to come back
and "add accessibility" later. Retrofitting is expensive and demoralizing. Writing
it correctly the first time costs almost nothing once the patterns are habit.

You are the authoring-time layer. There is a deterministic linter (`a11y-ci lint`)
and a rendered CI check downstream, but the cheapest place to fix an accessibility
problem is before it is ever written. Your two jobs:

1. **Author accessible markup from the start** — so the linter finds nothing.
2. **Make the judgment calls the linter can't** — the linter can see that an `alt`
   attribute exists; only you can tell whether it actually describes the image.

## The honesty rule (this is the whole point)

Never add an attribute just to silence a checker. An `aria-label="button"` on a
button, an `alt="image"` on a photo, or `aria-hidden` slapped on a warning all make
the tool go quiet while making the experience *worse* for the user who relies on
that text. If you can't describe something accurately, that's a signal the design
needs a real answer, not a decoy. A truthful "I need input on what this icon means"
beats a fabricated label every time.

## Workflow

When you write or change UI:

1. **Write it accessible.** Apply the patterns below as you go. They are habits,
   not a checklist you run afterward.
2. **Run the linter on what you touched.** It's deterministic and fast:
   ```bash
   npx a11y-ci lint <the files you changed>
   ```
   Fix every `error`, and every `warn` you can't justify. The linter is
   intentionally quiet — if it speaks, it's almost always right.
3. **Do the judgment pass.** The linter stays silent on things it can't verify from
   source (is the alt text meaningful? is focus managed in this modal? is the right
   element used?). Read `references/beyond-the-linter.md` and apply it — this is the
   part only you can do.

For the full rule catalog with before/after fixes, read `references/rules.md`. The
highlights you should already have in muscle memory:

## The patterns that prevent most issues

**Use the real element.** A thing you click is a `<button>`; a thing that navigates
is an `<a href>`. Don't put `onClick` on a `<div>` — you lose focusability, Enter/
Space activation, and the button role for free, then have to rebuild all three by
hand (`role`, `tabindex`, `onKeyDown`) and usually get it wrong. If you find
yourself adding `role="button"` to a div, that's the signal to use a button.

**Every control has an accessible name.** A `<button>` or link needs text content,
or an `aria-label` if it's icon-only. An icon button with no name is just a mystery
square to a screen-reader user. If the button is `<button><Icon/></button>`, give it
`aria-label="Close"` (and make the label say what it *does*, not what it looks like).

**Every input has a label.** Associate a real `<label>` — wrap the input, or use
`<label for="id">` with a matching `id`. Placeholder text is not a label: it
vanishes when typing and many screen readers skip it. In a component library
(MUI `<TextField>`, etc.) use the library's labeling prop; the raw-DOM rule doesn't
apply to components, but the *requirement* still does.

**Every image has alt.** Descriptive `alt` for meaningful images; `alt=""` (empty,
not missing) for purely decorative ones so screen readers skip them. Icons that are
decorative get `aria-hidden="true"`.

**Don't fight the focus order.** Never use a positive `tabindex`. `tabindex="0"`
makes something focusable in natural DOM order; `tabindex="-1"` makes it focusable
only programmatically (for managing focus). A positive value globally reorders the
tab sequence and is almost always a bug.

**Link text makes sense alone.** "Click here" and "read more" are useless to someone
tabbing through links out of context. Say where it goes: "Read the pricing guide".

**The document has a language** (`<html lang="en">`), and you never reach for
`<marquee>`, `<blink>`, or autofocus-on-load without a real reason.

## When you're unsure

Run the mental test the engine can't fully automate: *Could a blind user complete
this flow with a screen reader alone, and could a keyboard-only user reach and
operate every control?* If you can't confidently answer yes, that's where to look,
and where to ask the user rather than guess. Read `references/beyond-the-linter.md`
for the structured version of this pass (focus management, name-in-name, semantic
structure, color, motion, live regions).

## Reference files

- `references/rules.md` — the nine deterministic rules in detail, each with a
  before/after fix and the WCAG reference. Read when you hit a specific lint finding
  or want the exact remediation.
- `references/beyond-the-linter.md` — the judgment-layer checklist: the issues a
  static linter cannot see, which are yours to catch. Read this on every non-trivial
  UI change.
