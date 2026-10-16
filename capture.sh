#!/usr/bin/env bash
# Capture desktop + mobile screenshots of CAPTURE_URL into CAPTURE_DIR.
# - Opens the exact URL, waits for rendered WebGL content, saves
#   final-desktop.png (1440x900) and final-mobile.png (390x844).
# - Closes its own browser; leaves the app server running.
# - Capture output goes only to CAPTURE_DIR (outside the source tree).
# - Exit 75: temporary navigation/browser infrastructure failure.
# - Exit 1: script misuse or rendering defect.
# - Every significant command is timed with /usr/bin/time -p.
set -euo pipefail

if [[ -z "${CAPTURE_URL:-}" || -z "${CAPTURE_DIR:-}" ]]; then
  echo 'error: set CAPTURE_URL and CAPTURE_DIR.' >&2
  exit 1
fi
case "$CAPTURE_URL" in
  http://*|https://*) ;;
  *) echo "error: CAPTURE_URL must be http(s): $CAPTURE_URL" >&2; exit 1 ;;
esac

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p test -d "$CAPTURE_DIR"
/usr/bin/time -p test -n "${HOME:-}"
export CAPTURE_URL CAPTURE_DIR

# The browser runs from the shared Playwright runtime; the app itself is untouched.
/usr/bin/time -p test -n "${HOME:-}"
CAPTURE_JS="$(cat <<'NODE_EOF'
const { readFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { createRequire: makeRequire } = require('node:module');

const withCode = (code, message) => { const error = new Error(message); error.exitCode = code; return error; };
const fail = (code, ...args) => { throw withCode(code, args.map((part) => String(part && part.message ? part.message : part)).join(' ')); };
const url = process.env.CAPTURE_URL;
const output = process.env.CAPTURE_DIR;
if (!url || !output) fail(1, 'error: set CAPTURE_URL and CAPTURE_DIR.');
mkdirSync(output, { recursive: true });

const TEMPORARY = new Set([408, 429, 500, 502, 503, 504]);
const runtime = join(process.env.HOME, '.local/share/omgithub-playwright');
let playwrightRequire;
try {
  playwrightRequire = makeRequire(join(runtime, 'package.json'));
} catch (error) { fail(1, 'error: playwright runtime missing:', error.message); }
const { chromium } = playwrightRequire('playwright');
let config;
try {
  config = JSON.parse(readFileSync(join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'));
} catch (error) { fail(1, 'error: playwright config unreadable:', error.message); }
if (process.platform === 'linux' && !process.env.DISPLAY) {
  try {
    process.env.DISPLAY = ':' + readFileSync(join(runtime, 'display'), 'utf8').trim();
  } catch (error) { fail(75, 'error: no X display for headed browser:', error.message); }
}

(async () => {
  let browser;
  try {
    try {
      browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 });
    } catch (error) { fail(75, 'error: browser launch failed (infrastructure):', error.message); }
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      let page;
      try {
        page = await browser.newPage({ viewport: { width, height } });
      } catch (error) { fail(75, `error: new page failed for ${name} (infrastructure):`, error.message); }
      page.setDefaultTimeout(30000);
      page.on('pageerror', (error) => console.error(`pageerror (${name}):`, error.message));
      let response;
      try {
        response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      } catch (error) { fail(75, `error: navigation failed for ${name} (infrastructure):`, error.message); }
      if (!response) fail(75, `error: no response for ${name} (infrastructure).`);
      if (!response.ok()) {
        const status = response.status();
        fail(TEMPORARY.has(status) ? 75 : 1, `error: HTTP ${status} loading preview (${name}).`);
      }
      // Wait for rendered content: visible body, loaded fonts, live WebGL canvas.
      try {
        await page.locator('body').waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15000 });
        await page.waitForSelector('#game-canvas', { state: 'visible', timeout: 15000 });
        await page.waitForFunction(() => {
          const c = document.getElementById('game-canvas');
          return c && c.clientWidth > 0 && c.clientHeight > 0;
        }, null, { timeout: 15000 });
        await page.waitForTimeout(3000); // let WebGL frames settle
        const probe = await page.evaluate(() => {
          const c = document.getElementById('game-canvas');
          if (!c) return 'missing-canvas';
          const gl = c.getContext('webgl2') || c.getContext('webgl');
          if (!gl) return 'no-webgl';
          const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
          if (!w || !h) return 'empty-buffer';
          return 'ok';
        });
        if (probe !== 'ok') fail(1, `error: rendering defect (${name}): ${probe}.`);
      } catch (error) {
        if (error && error.message && error.message.startsWith('error: rendering defect')) throw error;
        fail(1, `error: rendered-content wait failed (${name}):`, error.message);
      }
      // Optional explicit start control (off by default; captures the exact URL as-is).
      if (process.env.CAPTURE_START_SELECTOR) {
        try {
          await page.locator(process.env.CAPTURE_START_SELECTOR).click({ timeout: 5000, noWaitAfter: true });
          await page.waitForTimeout(2000);
        } catch (error) { fail(1, 'error: start selector click failed:', error.message); }
      }
      try {
        await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 });
      } catch (error) {
        if (error.name === 'TimeoutError' || !browser.isConnected()) fail(75, `error: screenshot failed (${name}, infrastructure):`, error.message);
        fail(1, `error: screenshot failed (${name}):`, error.message);
      }
      console.log(`captured final-${name}.png`);
      await page.close().catch(() => {});
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch (error) {
        console.error('error: browser close failed:', error.message);
        if (process.exitCode !== 1) process.exitCode = 75;
      }
    }
  }
})().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(error && error.exitCode ? error.exitCode : 1);
});
NODE_EOF
)"
/usr/bin/time -p node -e "$CAPTURE_JS"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-mobile.png"
echo "capture complete: $CAPTURE_DIR"
