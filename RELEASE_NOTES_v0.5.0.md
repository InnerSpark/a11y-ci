# a11y-ci v0.5.0: live-DOM fingerprints

The regression diff identifies each offending node by a content fingerprint. v0.5
improves how that fingerprint is built: the engine now reads identity straight from
the rendered page rather than parsing axe's truncated `node.html`. Thanks to westont
(Assistiv Labs) and autosponge in the web-a11y thread for the discussion that drove
this.

## What changed

- **Computed accessible name and role.** The engine launches Chrome with the
  AccessibilityObjectModel flag and reads the spec-correct accessible name and role
  via `getComputedAccessibleNode`, with the previous heuristic as a fallback when
  the API is unavailable (for example headless builds without the feature). This
  resolves `aria-labelledby` and label associations that the html-scraping heuristic
  missed.
- **Computed colors from the live DOM.** Foreground and background are read with
  `getComputedStyle`, so a contrast node carries a stable color signal even when it
  has no text. axe's measured contrast pair is still preferred when present.
- **Honest "Known limitations" in the README.** A render-once scan cannot observe
  time-based or periodic behavior (auto-logout, carousels, polling), so it misses
  that class of barrier entirely. The gate cannot rank a swap by how critical the
  control is. Two nodes with identical fingerprints cannot be told apart. These are
  documented rather than papered over.
- **Added `CLAUDE.md`** for the repo (project orientation, build/release, writing
  style, and the known limitations).

Everything falls back cleanly: when the AccessibilityObjectModel API is not
available, the engine uses the prior heuristic name, so behavior degrades rather
than breaks. The diff, lint, and CLI surfaces are unchanged.

## Action required

1. Build and test: `npm run build`, `npm test`.
2. Publish (browser passkey, no `--otp`), `lint` before `cli`: `core`, `diff`,
   `llm`, `lint`, `cli`. `core` carries the real change; the rest are the 0.5.0
   version bump.
3. Confirm the latest tag (`gh release list --limit 1`), then
   `gh release create v0.5.0 --title "v0.5.0: live-DOM fingerprints" --notes-file RELEASE_NOTES_v0.5.0.md --latest`.
