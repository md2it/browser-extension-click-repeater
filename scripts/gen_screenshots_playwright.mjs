/**
 * Generate real screenshots using Playwright.
 * Renders the actual popup.html with real CSS/icons and mocked chrome storage.
 */

import { chromium } from 'playwright';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_DIR = path.resolve(__dirname, '../extension');
const OUT_DIR = path.resolve(__dirname, '../PUBLICATION/screenshots');

const W = 1280, H = 800;

// Mock data
const MOCK_DEFAULT_ID = 'click-001';
const MOCK_CLICKS = [
  {
    id: 'click-001',
    name: 'md2it.com 2026-06-07 15:55',
    repeats: 1,
    displayMoves: true,
    trackMoves: true,
    mode: 'position',
    steps: [{ position: '320,240' }]
  },
  {
    id: 'click-002',
    name: 'Some custom title',
    repeats: 3,
    displayMoves: false,
    trackMoves: false,
    mode: 'position',
    steps: [{ position: '100,100' }]
  },
  {
    id: 'click-003',
    name: 'google.com 2026-06-07 15:53',
    repeats: 1,
    displayMoves: true,
    trackMoves: true,
    mode: 'element',
    steps: [{ selector: 'button.search' }]
  },
  {
    id: 'click-004',
    name: 'My first clicks',
    repeats: 1,
    displayMoves: true,
    trackMoves: true,
    mode: 'position',
    steps: [{ position: '640,400' }]
  }
];

const MOCK_SETTINGS_LIGHT = {
  executionSpeed: 1,
  skipNewMacroExplanation: false,
  skipDisplayMovesExplanation: true,
  skipModeExplanation: false,
  darkTheme: false
};

const MOCK_SETTINGS_DARK = {
  ...MOCK_SETTINGS_LIGHT,
  darkTheme: true
};

// Script injected before any extension JS runs — mocks the chrome API
function buildInitScript(clicks, defaultId, settings, locale) {
  return `
    (() => {
      const STORAGE = {
        macros_list: ${JSON.stringify(clicks)},
        default_macro_id: ${JSON.stringify(defaultId)},
        popup_settings: ${JSON.stringify(settings)},
        locale: ${JSON.stringify(locale)}
      };

      const mockStorage = {
        get(keys, callback) {
          const result = {};
          const ks = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys));
          for (const k of ks) {
            if (k in STORAGE) result[k] = STORAGE[k];
          }
          if (callback) { callback(result); return; }
          return Promise.resolve(result);
        },
        set(items, callback) {
          Object.assign(STORAGE, items);
          if (callback) callback();
          return Promise.resolve();
        },
        remove(keys, callback) {
          const ks = Array.isArray(keys) ? keys : [keys];
          for (const k of ks) delete STORAGE[k];
          if (callback) callback();
          return Promise.resolve();
        }
      };

      const mockRuntime = {
        lastError: null,
        sendMessage(msg, callback) {
          const response = { ok: false, hasSession: false };
          if (callback) setTimeout(() => callback(response), 0);
        }
      };

      const mockTabs = {
        query(opts, callback) {
          const tabs = [{ id: 1, url: 'https://www.md2it.com/en/' }];
          if (callback) { callback(tabs); return; }
          return Promise.resolve(tabs);
        }
      };

      const mockChrome = { storage: { local: mockStorage }, runtime: mockRuntime, tabs: mockTabs };

      // Expose as both chrome and browser so api.js picks it up
      globalThis.chrome = mockChrome;
      globalThis.browser = undefined;
    })();
  `;
}

async function screenshotPopup(page, outputPath) {
  // Clip to the actual popup content (no extra whitespace)
  const box = await page.locator('.popup-shell').boundingBox();
  if (!box) throw new Error('popup-shell not found');
  return page.screenshot({
    path: outputPath,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height }
  });
}

// Compose two popup screenshots side-by-side on a 1280x800 background
async function compose(leftPath, rightPath, outputPath, dark) {
  const { createCanvas, loadImage } = await import('canvas');
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background gradient
  if (dark) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);
    // subtle gradient overlay
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(20,28,50,0.9)');
    g.addColorStop(1, 'rgba(10,14,30,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#dde1f0');
    g.addColorStop(1, '#c8cfe8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Fake browser address bar at top
  ctx.fillStyle = dark ? '#1a2035' : '#f0f1f5';
  ctx.fillRect(0, 0, W, 40);
  ctx.strokeStyle = dark ? '#2a3450' : '#d0d3e0';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(W, 40); ctx.stroke();

  // Address bar pill
  const barX = W / 2 - 220, barY = 8, barW = 440, barH = 24;
  ctx.fillStyle = dark ? '#252f4a' : '#ffffff';
  ctx.strokeStyle = dark ? '#3a4560' : '#d0d3e0';
  roundRect(ctx, barX, barY, barW, barH, 6);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark ? '#7080a0' : '#7080a0';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('chrome-extension://…/popup.html', W / 2, barY + barH / 2);

  const leftImg = await loadImage(leftPath);
  const rightImg = await loadImage(rightPath);

  const totalW = leftImg.width + rightImg.width + 40;
  const startX = Math.max(0, (W - totalW) / 2);
  const startY = Math.max(0, (H - 40 - Math.max(leftImg.height, rightImg.height)) / 2) + 40;

  // Drop shadows
  ctx.save();
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(0,0,0,0.01)'; // needed for shadow to render
  roundRect(ctx, startX, startY, leftImg.width, leftImg.height, 12);
  ctx.fill();
  roundRect(ctx, startX + leftImg.width + 40, startY, rightImg.width, rightImg.height, 12);
  ctx.fill();
  ctx.restore();

  // Draw popup images with rounded clip
  drawRounded(ctx, leftImg, startX, startY, leftImg.width, leftImg.height, 12);
  drawRounded(ctx, rightImg, startX + leftImg.width + 40, startY, rightImg.width, rightImg.height, 12);

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  console.log(`Saved ${outputPath}`);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawRounded(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

/**
 * Lucide "mouse-pointer" icon path: m4 4 7.07 17 2.51-7.39L21 11.07z
 * ViewBox 0 0 24 24 → normalized to [0..1], then scaled to `size` px.
 * Points (in 24×24 space):
 *   (4, 4) → (11.07, 21) → (13.58, 13.61) → (21, 11.07) → close
 */
function drawCursor(ctx, cx, cy, size = 18, alpha = 1) {
  const scale = size / 24;
  // The hotspot (tip) is at (4,4) in the 24×24 grid.
  // We place the tip at (cx, cy), so offset = -4*scale
  const ox = cx - 4 * scale;
  const oy = cy - 4 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgb(220,20,20)';
  ctx.strokeStyle = 'rgba(130,0,0,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ox + 4  * scale, oy + 4     * scale);  // tip
  ctx.lineTo(ox + 11.07 * scale, oy + 21 * scale);  // bottom
  ctx.lineTo(ox + 13.58 * scale, oy + 13.61 * scale); // inner notch
  ctx.lineTo(ox + 21 * scale, oy + 11.07 * scale);  // right
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Draw click ripple rings
function drawClickRipples(ctx, cx, cy, size, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const [r, a] of [[size * 1.5, 0.28], [size * 2.1, 0.18], [size * 2.8, 0.1]]) {
    ctx.strokeStyle = `rgba(220,20,20,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

async function genEN3(outputPath) {
  const { createCanvas, loadImage } = await import('canvas');

  // Use deviceScaleFactor:1 so screenshot pixels == CSS pixels (no DPR scaling)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setViewportSize({ width: W, height: H });

  await page.goto('https://www.md2it.com/en/', { waitUntil: 'networkidle', timeout: 30000 });

  // Get exact positions of the click targets BEFORE opening dropdown
  const summarySpanRect = await page.evaluate(() => {
    const el = document.querySelector('body > header > div > details > summary > span');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  // Click 1: somewhere in the middle of the page (hero area)
  const c1 = { x: Math.round(W * 0.38), y: Math.round(H * 0.52) };

  // Click 2: summary span
  const c2 = summarySpanRect || { x: W - 80, y: 28 };

  // Open the dropdown
  await page.evaluate(() => {
    const el = document.querySelector('body > header > div > details');
    if (el) el.setAttribute('open', '');
  });
  await page.waitForTimeout(300);

  // Get position of 4th list item after dropdown is open
  const li4Rect = await page.evaluate(() => {
    const el = document.querySelector('body > header > div > details > ul > li:nth-child(4) > a');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const c3 = li4Rect || { x: W - 80, y: 120 };

  // Take screenshot with dropdown open
  const pageScreenshot = await page.screenshot();
  await browser.close();

  // Composite on canvas
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const bgImg = await loadImage(pageScreenshot);
  ctx.drawImage(bgImg, 0, 0, W, H);

  // Draw ghost trace cursors between clicks (20% opacity)
  const traceAlpha = 0.2;
  function interp(p1, p2, n = 4) {
    const pts = [];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      pts.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
    }
    return pts;
  }

  // c1→c2: 3× more ghost cursors (12 instead of 4); c2→c3: keep 4
  const tracePoints = [...interp(c1, c2, 12), ...interp(c2, c3, 4)];
  for (const pt of tracePoints) {
    drawCursor(ctx, pt.x, pt.y, 28, traceAlpha);
  }

  // Draw the 3 clicks with full opacity + ripples
  for (const c of [c1, c2, c3]) {
    drawClickRipples(ctx, c.x, c.y, 28, 1);
    drawCursor(ctx, c.x, c.y, 32, 1);
  }

  // Flatten to RGB (no alpha) via a second canvas
  const rgbCanvas = createCanvas(W, H);
  const rgbCtx = rgbCanvas.getContext('2d');
  rgbCtx.fillStyle = '#ffffff';
  rgbCtx.fillRect(0, 0, W, H);
  rgbCtx.drawImage(canvas, 0, 0);
  fs.writeFileSync(outputPath, rgbCanvas.toBuffer('image/png'));
  console.log(`Saved ${outputPath}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const popupUrl = `file://${EXT_DIR}/popup.html`;

  async function renderPopup(clicks, defaultId, settings, locale, page_param) {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(buildInitScript(clicks, defaultId, settings, locale));

    const url = page_param ? `${popupUrl}?page=${page_param}` : popupUrl;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400); // let JS finish rendering

    const shot = await screenshotPopup(page);
    await context.close();
    return shot;
  }

  // ── EN-1: light theme ──────────────────────────────────────────────────────
  console.log('Rendering EN-1 (light)…');
  const lightList = await renderPopup(MOCK_CLICKS, MOCK_DEFAULT_ID, MOCK_SETTINGS_LIGHT, 'en', null);
  const lightSettings = await renderPopup(MOCK_CLICKS, MOCK_DEFAULT_ID, MOCK_SETTINGS_LIGHT, 'en', 'settings');

  const tmpLM = path.join(OUT_DIR, '_tmp_lm.png');
  const tmpLS = path.join(OUT_DIR, '_tmp_ls.png');
  fs.writeFileSync(tmpLM, lightList);
  fs.writeFileSync(tmpLS, lightSettings);
  await compose(tmpLM, tmpLS, path.join(OUT_DIR, 'EN-1.png'), false);

  // ── EN-2: dark theme ───────────────────────────────────────────────────────
  console.log('Rendering EN-2 (dark)…');
  const darkList = await renderPopup(MOCK_CLICKS, MOCK_DEFAULT_ID, MOCK_SETTINGS_DARK, 'en', null);
  const darkSettings = await renderPopup(MOCK_CLICKS, MOCK_DEFAULT_ID, MOCK_SETTINGS_DARK, 'en', 'settings');

  const tmpDM = path.join(OUT_DIR, '_tmp_dm.png');
  const tmpDS = path.join(OUT_DIR, '_tmp_ds.png');
  fs.writeFileSync(tmpDM, darkList);
  fs.writeFileSync(tmpDS, darkSettings);
  await compose(tmpDM, tmpDS, path.join(OUT_DIR, 'EN-2.png'), true);

  await browser.close();

  // Cleanup temp files
  for (const f of [tmpLM, tmpLS, tmpDM, tmpDS]) {
    try { fs.unlinkSync(f); } catch {}
  }

  // ── EN-3: real site + cursor overlay ──────────────────────────────────────
  console.log('Rendering EN-3 (md2it.com)…');
  await genEN3(path.join(OUT_DIR, 'EN-3.png'));

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
