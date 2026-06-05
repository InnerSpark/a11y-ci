import { chromium, type Browser, type Page } from 'playwright';

export interface RenderHandle {
  browser: Browser;
  page: Page;
}

/**
 * Launch Chromium and navigate to a URL, returning the live page so checks can
 * run against the rendered DOM.
 *
 * Navigation lessons carried over from production auditing:
 * - Commit on `domcontentloaded` first. Never use `networkidle` as the primary
 *   wait: it hangs forever on bot-mitigated pages (Cloudflare/reCAPTCHA/etc.).
 * - Then best-effort `networkidle` with a short cap so SPAs settle without hanging.
 * - Prefer the real Chrome channel when available for accurate rendering.
 */
export async function renderPage(
  url: string,
  opts: { useChromeChannel?: boolean; timeoutMs?: number } = {},
): Promise<RenderHandle> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const browser = await chromium.launch({
    ...(opts.useChromeChannel ? { channel: 'chrome' } : {}),
    // AccessibilityObjectModel exposes getComputedAccessibleNode(), letting us read
    // Chrome's real computed accessible name/role for issue fingerprints instead of
    // approximating it. Harmless if the build ignores the flag; the engine falls
    // back to a heuristic name. (Tip from autosponge in the web-a11y thread.)
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-blink-features=AccessibilityObjectModel'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(timeoutMs);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  // Best-effort settle for client-rendered apps; capped so we never hang.
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  // Small buffer for fonts/late layout so contrast and sizing measure the
  // painted state, not a mid-render frame.
  await page.waitForTimeout(500);

  return { browser, page };
}
