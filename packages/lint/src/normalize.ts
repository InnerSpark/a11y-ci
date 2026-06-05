/** Parse source into a flat list of NormalizedElement.
 *
 * Two front-ends, one output shape:
 *  - HTML  → parse5 (with source location info)
 *  - JSX/TSX/JS → the TypeScript compiler API (real AST, not regex)
 *
 * Using genuine parsers (never regex) is what keeps the false-positive rate low:
 * we only ever flag a construct we actually understood. */

import { parse } from 'parse5';
import ts from 'typescript';
import type { AttrValue, NormalizedElement } from './types.js';

/** Map a source attribute name to its canonical lowercase HTML form. */
function canonAttr(name: string): string {
  const n = name.toLowerCase();
  if (n === 'classname') return 'class';
  if (n === 'htmlfor') return 'for';
  return n; // onClick→onclick, tabIndex→tabindex, autoFocus→autofocus already handled by lowercasing
}

/** True for a real DOM tag (lowercase). JSX components are Uppercase or dotted. */
function isDomTag(tag: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(tag);
}

const VOID_OR_TEXTLESS = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area']);

// ---------------------------------------------------------------------------
// HTML (parse5)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeHtml(code: string, file: string): NormalizedElement[] {
  const doc = parse(code, { sourceCodeLocationInfo: true }) as any;
  const out: NormalizedElement[] = [];

  const walk = (node: any, inLabel: boolean): void => {
    const children: any[] = node.childNodes ?? [];
    for (const child of children) {
      if (typeof child.tagName === 'string') {
        const tag = child.tagName.toLowerCase();
        const attrs = new Map<string, AttrValue>();
        for (const a of child.attrs ?? []) {
          attrs.set(canonAttr(a.name), a.value === '' ? true : a.value);
        }
        const { text, hasDynamicText } = directText(child);
        const childTags = (child.childNodes ?? [])
          .filter((c: any) => typeof c.tagName === 'string')
          .map((c: any) => c.tagName.toLowerCase());
        const loc = child.sourceCodeLocation;
        out.push({
          tag,
          attrs,
          text,
          hasDynamicText,
          childTags,
          inLabel,
          file,
          line: loc?.startLine ?? 1,
          column: loc?.startCol ?? 1,
          snippet: snippetFor(code, loc),
        });
        walk(child, inLabel || tag === 'label');
      } else if (child.childNodes) {
        walk(child, inLabel);
      }
    }
  };

  // parse5 wraps content in html>head/body; just walk from the document root.
  walk(doc, false);
  return out;
}

function directText(node: any): { text: string; hasDynamicText: boolean } {
  let text = '';
  for (const c of node.childNodes ?? []) {
    if (c.nodeName === '#text' && typeof c.value === 'string') text += c.value;
  }
  return { text: text.trim(), hasDynamicText: false };
}

function snippetFor(code: string, loc: any): string {
  if (!loc || typeof loc.startOffset !== 'number') return '';
  const end = typeof loc.startTag?.endOffset === 'number' ? loc.startTag.endOffset : loc.endOffset;
  return code.slice(loc.startOffset, Math.min(end ?? loc.startOffset, loc.startOffset + 200)).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// JSX / TSX (TypeScript AST)
// ---------------------------------------------------------------------------

export function normalizeJsx(code: string, file: string): NormalizedElement[] {
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TSX);
  const out: NormalizedElement[] = [];

  const readAttrs = (opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement): Map<string, AttrValue> => {
    const attrs = new Map<string, AttrValue>();
    for (const prop of opening.attributes.properties) {
      if (!ts.isJsxAttribute(prop)) continue; // skip {...spread}
      const name = canonAttr(prop.name.getText(sf));
      const init = prop.initializer;
      if (init === undefined) {
        attrs.set(name, true);
      } else if (ts.isStringLiteral(init)) {
        attrs.set(name, init.text);
      } else if (ts.isJsxExpression(init) && init.expression) {
        const expr = init.expression;
        if (ts.isStringLiteralLike(expr)) {
          attrs.set(name, expr.text);
        } else if (ts.isNumericLiteral(expr)) {
          attrs.set(name, expr.text); // tabIndex={3}
        } else if (ts.isPrefixUnaryExpression(expr) && ts.isNumericLiteral(expr.operand)) {
          const sign = expr.operator === ts.SyntaxKind.MinusToken ? '-' : '';
          attrs.set(name, sign + expr.operand.text); // tabIndex={-1}
        } else {
          attrs.set(name, null); // genuinely dynamic
        }
      } else {
        attrs.set(name, null); // dynamic value
      }
    }
    return attrs;
  };

  const childInfo = (el: ts.JsxElement): { text: string; hasDynamicText: boolean; childTags: string[] } => {
    let text = '';
    let hasDynamicText = false;
    const childTags: string[] = [];
    for (const child of el.children) {
      if (ts.isJsxText(child)) {
        text += child.text;
      } else if (ts.isJsxExpression(child)) {
        if (child.expression && ts.isStringLiteralLike(child.expression)) text += child.expression.text;
        else if (child.expression) hasDynamicText = true;
      } else if (ts.isJsxElement(child)) {
        childTags.push(child.openingElement.tagName.getText(sf).toLowerCase());
      } else if (ts.isJsxSelfClosingElement(child)) {
        childTags.push(child.tagName.getText(sf).toLowerCase());
      }
    }
    return { text: text.trim(), hasDynamicText, childTags };
  };

  const push = (
    tagName: string,
    opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    node: ts.Node,
    info: { text: string; hasDynamicText: boolean; childTags: string[] },
    inLabel: boolean,
  ): void => {
    // Decide DOM-vs-component on the ORIGINAL casing: a JSX DOM element is
    // lowercase (`div`, `select`), a component is Uppercase or dotted
    // (`Select`, `TextField`, `motion.div`). Lowercasing first would misread
    // every MUI/React component as a raw DOM tag.
    if (!isDomTag(tagName)) return;
    const tag = tagName.toLowerCase();
    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push({
      tag,
      attrs: readAttrs(opening),
      text: info.text,
      hasDynamicText: info.hasDynamicText,
      childTags: info.childTags,
      inLabel,
      file,
      line: pos.line + 1,
      column: pos.character + 1,
      snippet: opening.getText(sf).replace(/\s+/g, ' ').trim().slice(0, 200),
    });
  };

  const visit = (node: ts.Node, inLabel: boolean): void => {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sf);
      push(tag, node.openingElement, node, childInfo(node), inLabel);
      const nextInLabel = inLabel || tag.toLowerCase() === 'label';
      node.children.forEach((c) => visit(c, nextInLabel));
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      push(node.tagName.getText(sf), node, node, { text: '', hasDynamicText: false, childTags: [] }, inLabel);
      return;
    }
    ts.forEachChild(node, (c) => visit(c, inLabel));
  };

  visit(sf, false);
  return out;
}

// ---------------------------------------------------------------------------

export function normalize(code: string, file: string): NormalizedElement[] {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  if (ext === '.html' || ext === '.htm') return normalizeHtml(code, file);
  return normalizeJsx(code, file);
}

export { isDomTag, VOID_OR_TEXTLESS };
