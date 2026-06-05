// Tests for @a11yci/diff. Run from the repo root with `npm test` (builds first,
// then `node --test`). These import the built ESM from ../dist, so the package
// must be compiled. Plain .mjs keeps the test suite zero-dependency.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, gatingRegressions } from '../dist/index.js';

/** Build an AuditResult with a single page carrying the given issues. */
function audit(url, issues) {
  return { timestamp: 't', overallScore: 0, issues: [], pages: [{ url, score: 0, renderMode: 'playwright', issues }] };
}

/** A color-contrast issue. axe aggregates to one issue per rule per page, with
 * `element` = the FIRST offending node and `instanceCount` = how many matched. */
function contrast({ element = '#main .css-aaaaaa', count = 1 } = {}) {
  return {
    id: 'axe-color-contrast',
    severity: 'fail',
    title: 'Elements must meet minimum color contrast',
    description: '',
    wcagRef: 'WCAG 1.4.3',
    wcagLevel: 'AA',
    element,
    impact: 'serious',
    instanceCount: count,
  };
}

function imageAlt({ element = 'ul li:nth-child(1) img', count = 1 } = {}) {
  return { id: 'axe-image-alt', severity: 'fail', title: 'Images must have alternate text', description: '', wcagRef: 'WCAG 1.1.1', wcagLevel: 'A', element, impact: 'serious', instanceCount: count };
}

/** A color-contrast issue carrying explicit per-node content fingerprints, which
 * is what the engine now emits. Each entry is one offending node. */
function contrastNodes(fingerprints) {
  return {
    id: 'axe-color-contrast', severity: 'fail', title: 'Elements must meet minimum color contrast',
    description: '', wcagRef: 'WCAG 1.4.3', wcagLevel: 'AA', element: '#main .css-x', impact: 'serious',
    instanceCount: fingerprints.length,
    nodes: fingerprints.map((fp) => ({ fingerprint: fp })),
  };
}

test('a brand-new signature is reported as added/new', () => {
  const base = audit('/p', []);
  const head = audit('/p', [contrast()]);
  const d = diff(base, head);
  assert.equal(d.added.length, 1);
  assert.equal(d.added[0].change, 'new');
  assert.equal(d.fixed.length, 0);
  assert.equal(d.unchanged.length, 0);
});

test('the same signature at the same count is unchanged', () => {
  const base = audit('/p', [contrast({ count: 3 })]);
  const head = audit('/p', [contrast({ count: 3 })]);
  const d = diff(base, head);
  assert.equal(d.added.length, 0);
  assert.equal(d.unchanged.length, 1);
});

test('framework-hash churn alone does not read as a new issue', () => {
  // Same structural selector, different emotion hash, same count.
  const base = audit('/p', [contrast({ element: '#main .css-4rgs2', count: 3 })]);
  const head = audit('/p', [contrast({ element: '#main .css-fh24a9', count: 3 })]);
  const d = diff(base, head);
  assert.equal(d.added.length, 0, 'hash churn must not be a regression');
  assert.equal(d.unchanged.length, 1);
});

test('more instances of an existing signature is a worsened regression', () => {
  const base = audit('/p', [imageAlt({ count: 1 })]);
  const head = audit('/p', [imageAlt({ count: 3 })]);
  const d = diff(base, head);
  assert.equal(d.added.length, 1);
  assert.equal(d.added[0].change, 'worsened');
  assert.equal(d.added[0].addedInstances, 2);
  assert.equal(d.added[0].issue.instanceCount, 2, 'gates the delta, not the whole pile');
});

test('fewer instances is a partial fix, not gated', () => {
  const base = audit('/p', [imageAlt({ count: 3 })]);
  const head = audit('/p', [imageAlt({ count: 1 })]);
  const d = diff(base, head);
  assert.equal(d.added.length, 0);
  assert.equal(d.unchanged.length, 1);
});

test('a signature gone from head is reported as fixed', () => {
  const base = audit('/p', [contrast()]);
  const head = audit('/p', []);
  const d = diff(base, head);
  assert.equal(d.fixed.length, 1);
  assert.equal(d.added.length, 0);
});

test('gatingRegressions filters added by severity', () => {
  const warn = { ...contrast(), id: 'axe-region', severity: 'warn' };
  const base = audit('/p', []);
  const head = audit('/p', [contrast(), warn]);
  const d = diff(base, head);
  assert.equal(gatingRegressions(d, 'fail').length, 1, 'only the fail gates at fail');
  assert.equal(gatingRegressions(d, 'warn').length, 2, 'both gate at warn');
});

// #5 fix: with per-node content fingerprints (what the engine now emits), a
// same-count swap IS caught. The removed link and the added button have
// different fingerprints (different tag), so the button is a newly introduced
// instance even though the count is unchanged and selectors would both
// normalize to `#main .css-*`.
test('node fingerprints catch a same-count element swap (#5)', () => {
  const shared = Array.from({ length: 32 }, (_, i) => `span~~label ${i}~#777777:#ffffff:3`);
  const base = audit('/checkout', [contrastNodes([...shared, 'a~~Buy now~#999999:#ffffff:2.1'])]); // a link
  const head = audit('/checkout', [contrastNodes([...shared, 'button~~Buy now~#999999:#ffffff:2.1'])]); // a button
  const d = diff(base, head);
  assert.equal(d.added.length, 1);
  assert.equal(d.added[0].change, 'worsened');
  assert.equal(d.added[0].addedInstances, 1, 'the new button-contrast node is the regression');
});

// Selector-only fallback (no node data, e.g. older JSON) still cannot see a
// swap: all it has is the normalized selector, which is identical after the hash
// is wildcarded. A limitation of inputs that predate fingerprints; the engine
// now always provides them.
test('selector-only fallback cannot see a swap (no node data)', () => {
  const base = audit('/checkout', [contrast({ element: '#main .css-4rgs2', count: 33 })]);
  const head = audit('/checkout', [contrast({ element: '#main .css-fh24a9', count: 33 })]);
  const d = diff(base, head);
  assert.equal(d.added.length, 0);
  assert.equal(d.unchanged.length, 1);
});

// RESIDUAL HOLE (raised by westont and autosponge): two controls with identical
// content fingerprints are indistinguishable, so swapping one identical-looking
// control for another reads as unchanged. This is acceptable: the replacement
// has the same accessibility characteristics as what it replaced. Documented,
// not fixed, because disambiguating it would require positional data that churns.
test('residual: identical fingerprints are indistinguishable on swap', () => {
  const base = audit('/p', [contrastNodes(['button~~Submit~#aaaaaa:#ffffff:2.4'])]);
  const head = audit('/p', [contrastNodes(['button~~Submit~#aaaaaa:#ffffff:2.4'])]);
  const d = diff(base, head);
  assert.equal(d.added.length, 0);
  assert.equal(d.unchanged.length, 1);
});
