# a11y-ci v0.4.0: content-fingerprint regression diff

This release makes the regression diff resilient to a class of misses that
selector-based identity could not see, raised by westont in #5 (a follow-up to the
count-aware fix in v0.3).

## The problem

axe reports one issue per rule per page, and its generated selector latches onto
the random Emotion/MUI `css-XXXX` class because it looks unique on the page, then
shortens the selector around it and drops the tag and context. The diff then
wildcards the hash (`css-*`), so a bad-contrast link `#main .css-4rgs2` and a
bad-contrast button `#main .css-fh24a9` both reduce to `#main .css-*`. If a change
removes the link and adds the button (count unchanged), the diff saw no difference
and the new failure was never gated. The v0.3 count-aware fix only caught a net
*increase* in instances, so an even swap stayed invisible.

## The fix

Identity is now **per node, by content fingerprint**, not by selector.

- The engine (`@a11yci/core`) fingerprints each offending node from stable content:
  tag, role, type, accessible name / visible text (from the node's HTML), plus
  rule-specific data (for `color-contrast`, the foreground/background color pair
  and ratio axe already returns). The css-class is deliberately excluded, so the
  fingerprint does not churn between builds. Issues now carry `nodes: IssueNode[]`.
- The diff (`@a11yci/diff`) compares the multisets of those fingerprints per rule.
  A head fingerprint base did not have is a newly introduced instance, surfaced as
  an added entry (`change: 'worsened'`, or `'new'` for a wholly new rule). This
  catches new rules, higher counts, and same-count swaps, while still absorbing
  framework-hash churn. When an issue carries no `nodes` (older JSON), it falls
  back to the normalized selector repeated by `instanceCount` (the v0.3 behavior).

This also resolves the secondary first-node churn from #4 (a moved first node
reading as fixed + added).

## Known limitation

Two controls with identical content fingerprints are indistinguishable, so
swapping one identical-looking control for another reads as unchanged. This is
acceptable: the replacement has the same accessibility characteristics as what it
replaced. Disambiguating it would require positional data that churns on layout
changes. Raised by westont and autosponge; documented with a test rather than
papered over. Note too that axe's node HTML can be truncated, so a fingerprint is
best-effort from what axe provides.

## Tests

`@a11yci/diff` gained a `node:test` suite (run with `npm test`): new / unchanged /
worsened / partial-fix / fixed / framework-hash churn / `gatingRegressions`, the
#5 swap now caught via fingerprints, the selector-only fallback limitation, and the
residual identical-fingerprint hole.

## Action required

1. Build: `npm install && npm run build`, then `npm test`.
2. Publish the packages (browser passkey auth, no `--otp`), `lint` before `cli`:
   `core`, `diff`, `llm`, `lint`, `cli`. All carry the 0.4.0 bump; `core` and
   `diff` have real behavior changes.
3. Tag: confirm the latest tag (`gh release list --limit 1`), then
   `gh release create v0.4.0 --title "v0.4.0: content-fingerprint diff" --notes-file RELEASE_NOTES_v0.4.0.md --latest`.
