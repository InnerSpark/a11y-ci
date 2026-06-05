# Beyond the linter — the judgment pass

A static linter checks whether the right *attributes* exist. It cannot judge whether
they're *correct*, and it can't see anything that emerges only when components
compose or the page runs. That gap — roughly the majority of real accessibility
problems — is yours. Run this pass on every non-trivial UI change.

The throughline: **presence is not meaning.** An `alt` exists, but does it describe
the image? A heading exists, but is it in order? A label exists, but does it match
what the user sees? You are checking meaning.

## 1. Is the text actually meaningful?

- **Alt text.** Does it convey what the image *communicates here*, not just that an
  image is present? A product photo's alt depends on context: in a gallery it's the
  product name; next to a paragraph already naming the product, it may be decorative
  (`alt=""`). A chart's alt should state the takeaway, not "chart".
- **Accessible names.** Does the `aria-label` say what the control *does*? "Close",
  not "X". "Search", not "magnifying glass".
- **Link text.** Beyond the obvious "click here": does "Learn more" tell the user
  *more about what*? Pull it toward the destination.

## 2. Name-in-name: does the accessible name match the visible text? (WCAG 2.5.3)

If a button visibly reads "Submit order" but has `aria-label="Buy"`, a voice-control
user who says "click Submit order" gets nothing, because the accessible name is
"Buy". When a control has visible text, its accessible name must contain that visible
text. Prefer letting the visible text *be* the name (no aria-label at all); add
aria-label only for icon-only controls, and make it match any adjacent visible label.

## 3. Semantic structure — is this the right element?

- **Headings** describe the outline of the page. Don't pick `<h3>` because you want
  smaller text — pick the level that reflects the hierarchy, and style separately.
  Don't skip levels (h2 → h4). The linter can't see whether your headings tell a
  coherent story; you can.
- **Landmarks.** Real page regions are `<header> <nav> <main> <footer>`, not
  `<div class="nav">`. Screen-reader users navigate by these.
- **Lists** are `<ul>/<ol>/<li>`; tabular data is a `<table>` with `<th>`, not a grid
  of divs. The element communicates the relationship.

## 4. Focus management — the thing static analysis most often misses

- **Modals/dialogs.** When a dialog opens, move focus into it; trap focus inside
  while open; restore focus to the trigger on close. Esc should close it. A dialog
  that opens but leaves focus behind on the page is unusable by keyboard.
- **Route changes / async content.** After a client-side navigation or when new
  content loads, focus and/or announce it, or the screen-reader user doesn't know
  anything changed.
- **Visible focus.** Never `outline: none` without an equally clear replacement.
  Keyboard users need to see where they are. A custom `:focus-visible` style is fine;
  removing the indicator is not.
- **Focus order.** Does tabbing move through the UI in an order that matches the
  visual layout and makes sense? Reordering with CSS can desync them.

## 5. Color and sensory cues (WCAG 1.4.1, 1.4.3)

- **Don't rely on color alone.** A red border for an invalid field, a green dot for
  "online" — pair color with text, an icon, or a pattern. Colorblind users miss the
  color.
- **Contrast.** The rendered engine measures this precisely, but at authoring time
  don't pair light-gray text on white or low-contrast buttons. Aim 4.5:1 for body
  text, 3:1 for large text and UI component boundaries.
- **No instructions that depend on sense.** "Click the button on the right", "the
  green one" — add a name: "Click Save, on the right".

## 6. Keyboard operability of anything custom

If you built a custom widget (menu, combobox, tabs, slider, tree), it needs the
keyboard interactions its native counterpart has — arrow keys, Home/End, Enter/Space,
Esc — and the matching ARIA roles/states. The linter can confirm a role string
exists; it can't test that arrow keys work. Follow the ARIA Authoring Practices for
the pattern, or better, use a vetted headless component library and don't hand-roll.

## 7. Dynamic states and live regions (WCAG 4.1.3)

- **Errors.** A form error must be programmatically tied to its field
  (`aria-describedby`), announced (`role="alert"` / `aria-live="assertive"`), and
  ideally focus moves to the first error. A red message that's only visual is
  invisible to a screen reader.
- **Async updates.** "Saved", "3 results found", a loading→loaded transition — put
  these in a live region (`aria-live="polite"`) so they're announced. Keep the live
  region in the DOM; don't `display:none` it when idle (toggling it off can suppress
  the announcement) — leave it present and empty.
- **Busy/disabled.** While a button is submitting, reflect it (`aria-disabled`,
  updated text) so the state is perceivable, not just a spinner.

## The test to keep in your head

For any flow you build, ask two concrete questions:

1. **Screen reader only:** could a blind user complete this start to finish hearing
   only what's announced — no reliance on layout, color, or position?
2. **Keyboard only:** can someone with no mouse reach every control, see where focus
   is, operate everything, and never get trapped?

If either answer is "not sure", that's the spot to fix or to ask the user about —
not to paper over with an attribute that quiets the tool.
