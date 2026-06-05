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

// KNOWN GAP — same-count swap is invisible. Tracked in #5 (content-based node
// fingerprinting). axe reports one issue per rule per page
// with only the first node's selector + a count, and normalization collapses
// `#main .css-4rgs2` (a link) and `#main .css-fh24a9` (a button) to the same
// `#main .css-*`. So removing one bad-contrast node and adding a different one
// (count unchanged) reads as `unchanged`, and the newly introduced failure is
// not gated. This test documents the CURRENT behavior; when node fingerprinting
// lands it should flip to expecting an added/worsened entry.
test('KNOWN GAP: a same-count swap currently slips through (tracked in follow-up)', () => {
  const base = audit('/checkout', [contrast({ element: '#main .css-4rgs2', count: 33 })]); // a link
  const head = audit('/checkout', [contrast({ element: '#main .css-fh24a9', count: 33 })]); // a button, same count
  const d = diff(base, head);
  assert.equal(d.added.length, 0, 'documents the blind spot, not the desired end state');
  assert.equal(d.unchanged.length, 1);
});
