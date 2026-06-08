/**
 * Generate Russian screenshot set for Chrome Web Store:
 *   PUBLICATION/screenshots/RU-1.png  — md2it.com/ru/click-repeater/ with Chrome+Firefox download clicks
 *   PUBLICATION/screenshots/RU-2.png  — popup main + settings, light theme
 *   PUBLICATION/screenshots/RU-3.png  — popup main + settings, dark theme
 *
 * RU-1 design notes:
 *   - Page: https://www.md2it.com/{locale}/click-repeater/
 *   - Browser bar shows https://www.md2it.com/click-repeater/ (no locale, universal)
 *   - Click trace: page content → Chrome button → Firefox button
 *
 * Storage keys match post-rebranding code (clicks_list, default_click_id).
 */

import { chromium } from 'playwright';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_DIR = path.resolve(__dirname, '../extension');
const OUT_DIR = path.resolve(__dirname, '../PUBLICATION/screenshots');

const W = 1280, H = 800;

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_DEFAULT_ID = 'click-001';

const MOCK_CLICKS = [
  {
    id: 'click-001',
    name: 'md2it.com/click-repeater 2026-06-08 15:02',
    repeats: 1,
    displayMoves: true,
    trackMoves: true,
    mode: 'position',
    steps: [{ position: '320,240' }]
  },
  {
    id: 'click-002',
    name: 'Отчёты для работы',
    repeats: 1,
    displayMoves: true,
    trackMoves: true,
    mode: 'position',
    steps: [{ position: '640,360' }]
  },
  {
    id: 'click-003',
    name: 'Для листания блога',
    repeats: 50,
    displayMoves: true,
    trackMoves: true,
    mode: 'position',
    steps: [{ position: '640,500' }]
  },
  {
    id: 'click-004',
    name: 'Скачать семейные фото',
    repeats: 10,
    displayMoves: false,
    trackMoves: false,
    mode: 'position',
    steps: [{ position: '200,400' }]
  }
];

const MOCK_SETTINGS_LIGHT = {
  executionSpeed: 1,
  skipNewClickExplanation: false,
  skipDisplayMovesExplanation: true,
  skipModeExplanation: false,
  darkTheme: false
};

const MOCK_SETTINGS_DARK = { ...MOCK_SETTINGS_LIGHT, darkTheme: true };

function buildInitScript(clicks, defaultId, settings) {
  return `
    (() => {
      const STORAGE = {
        clicks_list: ${JSON.stringify(clicks)},
        default_click_id: ${JSON.stringify(defaultId)},
        popup_settings: ${JSON.stringify(settings)},
        locale: 'ru'
      };

      const mockStorage = {
        get(keys, callback) {
          const result = {};
          const ks = Array.isArray(keys) ? keys
            : (typeof keys === 'string' ? [keys] : Object.keys(keys));
          for (const k of ks) if (k in STORAGE) result[k] = STORAGE[k];
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
          if (callback) setTimeout(() => callback({ ok: false, hasSession: false }), 0);
        }
      };

      const mockTabs = {
        query(opts, callback) {
          const tabs = [{ id: 1, url: 'https://www.md2it.com/ru/click-repeater/' }];
          if (callback) { callback(tabs); return; }
          return Promise.resolve(tabs);
        }
      };

      globalThis.chrome  = { storage: { local: mockStorage }, runtime: mockRuntime, tabs: mockTabs };
      globalThis.browser = undefined;
    })();
  `;
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);      ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,       x + w, y + r,       r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h,   x + w - r, y + h,   r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h,   x,     y + h - r,   r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,       x + r, y,            r);
  ctx.closePath();
}

function drawRounded(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

// Cursor matches extension tracker: fill=white, stroke=#012292, tip at (cx,cy).
function drawCursor(ctx, cx, cy, size = 36, alpha = 1) {
  const s = size / 24, ox = cx - 4 * s, oy = cy - 4 * s;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = '#ffffff';
  ctx.strokeStyle = '#012292';
  ctx.lineWidth   = Math.max(0.8, 2 * s);
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(ox + 4     * s, oy + 4     * s);
  ctx.lineTo(ox + 11.07 * s, oy + 21    * s);
  ctx.lineTo(ox + 13.58 * s, oy + 13.61 * s);
  ctx.lineTo(ox + 21    * s, oy + 11.07 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

// Ripples match spawnClickRipple(): 5 rings, #012292/white alternating, snapshot t=280ms.
function drawClickRipples(ctx, cx, cy, scale = 1.0) {
  const colors = ['#012292', '#ffffff', '#012292', '#ffffff', '#012292'];
  ctx.save();
  for (let i = 0; i < colors.length; i++) {
    const elapsed = Math.max(0, 280 - i * 60);
    if (elapsed === 0) continue;
    const t = elapsed / 500;
    const r = ((60 + i * 10) * t / 2) * scale;
    const a = 0.7 * (1 - t);
    ctx.globalAlpha = a;
    ctx.strokeStyle = colors[i];
    ctx.lineWidth   = Math.max(0.8, 2 * scale);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** Ghost trace between two points using spacing-based step count. */
function drawTrace(ctx, p1, p2, spacing, size, alpha = 0.28) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const n = Math.max(0, Math.round(Math.hypot(dx, dy) / spacing) - 1);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    drawCursor(ctx, p1.x + dx * t, p1.y + dy * t, size, alpha);
  }
}

/** Fake browser address bar drawn at the very top of the canvas. */
function drawBrowserBar(ctx, url) {
  ctx.fillStyle = '#f0f1f5';
  ctx.fillRect(0, 0, W, 40);
  ctx.strokeStyle = '#d0d3e0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(W, 40); ctx.stroke();

  const barX = W / 2 - 240, barY = 8, barW = 480, barH = 24;
  ctx.fillStyle   = '#ffffff';
  ctx.strokeStyle = '#d0d3e0';
  roundRect(ctx, barX, barY, barW, barH, 6); ctx.fill(); ctx.stroke();

  ctx.fillStyle      = '#374151';
  ctx.font           = '12px Arial';
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'middle';
  ctx.fillText(url, W / 2, barY + barH / 2);
}

// ── Popup screenshot helper ────────────────────────────────────────────────────

async function screenshotPopup(page) {
  const box = await page.locator('.popup-shell').boundingBox();
  if (!box) throw new Error('.popup-shell not found');
  return page.screenshot({
    clip: { x: box.x, y: box.y, width: box.width, height: box.height }
  });
}

// ── Compose two popup images side-by-side on a 1280×800 background ─────────

async function compose(leftBuf, rightBuf, outputPath, dark) {
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  if (dark) {
    ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(20,28,50,0.9)'); g.addColorStop(1, 'rgba(10,14,30,0.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#dde1f0'); g.addColorStop(1, '#c8cfe8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // Browser bar (popup URL)
  ctx.fillStyle   = dark ? '#1a2035' : '#f0f1f5'; ctx.fillRect(0, 0, W, 40);
  ctx.strokeStyle = dark ? '#2a3450' : '#d0d3e0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(W, 40); ctx.stroke();

  const barX = W / 2 - 220, barY = 8, barW = 440, barH = 24;
  ctx.fillStyle   = dark ? '#252f4a' : '#ffffff';
  ctx.strokeStyle = dark ? '#3a4560' : '#d0d3e0';
  roundRect(ctx, barX, barY, barW, barH, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle    = '#7080a0'; ctx.font = '12px Arial';
  ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('chrome-extension://…/popup.html', W / 2, barY + barH / 2);

  const leftImg  = await loadImage(leftBuf);
  const rightImg = await loadImage(rightBuf);

  const totalW = leftImg.width + rightImg.width + 40;
  const startX = Math.max(0, (W - totalW) / 2);
  const startY = Math.max(0, (H - 40 - Math.max(leftImg.height, rightImg.height)) / 2) + 40;

  ctx.save();
  ctx.shadowColor   = dark ? 'rgba(160,185,255,0.45)' : 'rgba(0,0,0,0.22)';
  ctx.shadowBlur    = dark ? 36 : 24;
  ctx.shadowOffsetY = dark ? 0  : 6;
  ctx.fillStyle     = 'rgba(0,0,0,0.01)';
  roundRect(ctx, startX, startY, leftImg.width, leftImg.height, 12); ctx.fill();
  roundRect(ctx, startX + leftImg.width + 40, startY, rightImg.width, rightImg.height, 12); ctx.fill();
  ctx.restore();

  drawRounded(ctx, leftImg,  startX, startY, leftImg.width, leftImg.height, 12);
  drawRounded(ctx, rightImg, startX + leftImg.width + 40, startY, rightImg.width, rightImg.height, 12);

  if (dark) {
    ctx.save();
    ctx.strokeStyle = 'rgba(100,120,200,0.35)'; ctx.lineWidth = 1;
    roundRect(ctx, startX, startY, leftImg.width, leftImg.height, 12); ctx.stroke();
    roundRect(ctx, startX + leftImg.width + 40, startY, rightImg.width, rightImg.height, 12); ctx.stroke();
    ctx.restore();
  }

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  console.log(`Saved ${outputPath}`);
}

// ── Slide-1: product page with Chrome + Firefox download clicks ───────────────
//
// Generic: works for any locale by substituting the locale prefix in the URL.
// The browser bar always shows the locale-free canonical URL.
//
// Click sequence:
//   c1 — a point of interest in the page content (hero / feature area)
//   c2 — Chrome download button  (a.button:nth-of-type(1))
//   c3 — Firefox download button (a.button:nth-of-type(2))

async function genSlide1(outputPath, locale = 'ru') {
  const pageUrl = `https://www.md2it.com/${locale}/click-repeater/`;
  // Canonical URL shown in the address bar (no locale prefix — universal across languages)
  const barUrl  = 'https://www.md2it.com/click-repeater/';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page    = await context.newPage();
  await page.setViewportSize({ width: W, height: H });
  await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // Get positions of the two primary download buttons
  const btnRects = await page.evaluate(() => {
    return [...document.querySelectorAll('a.button--primary')].map(el => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
  });

  const c2 = btnRects[0] || { x: 161, y: 681 }; // Chrome
  const c3 = btnRects[1] || { x: 257, y: 681 }; // Firefox

  // c1: a meaningful point in the page body above the buttons
  // Position relative to the content (not too close to the bar, not too close to buttons)
  const c1 = { x: Math.round(W * 0.38), y: Math.round(H * 0.40) };

  const pageScreenshot = await page.screenshot();
  await browser.close();

  // Composite
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Page fills full canvas, then bar overlaid on top (covers page header)
  ctx.drawImage(await loadImage(pageScreenshot), 0, 0, W, H);
  drawBrowserBar(ctx, barUrl);

  // Ghost traces (spacing 55px between ghosts)
  drawTrace(ctx, c1, c2, 55, 36, 0.28);
  drawTrace(ctx, c2, c3, 55, 36, 0.28);

  // Click points
  for (const c of [c1, c2, c3]) {
    drawClickRipples(ctx, c.x, c.y, 1.0);
    drawCursor(ctx, c.x, c.y, 54, 1); // TRACKER_ACTIVE_SIZE
  }

  // Flatten to RGB
  const rgb  = createCanvas(W, H);
  const rctx = rgb.getContext('2d');
  rctx.fillStyle = '#ffffff'; rctx.fillRect(0, 0, W, H);
  rctx.drawImage(canvas, 0, 0);
  fs.writeFileSync(outputPath, rgb.toBuffer('image/png'));
  console.log(`Saved ${outputPath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── RU-1 ─────────────────────────────────────────────────────────────────────
  console.log('Rendering RU-1 (md2it.com/ru/click-repeater/ — Chrome + Firefox clicks)…');
  await genSlide1(path.join(OUT_DIR, 'RU-1.png'), 'ru');

  // ── RU-2 & RU-3: popup ───────────────────────────────────────────────────────
  const browser   = await chromium.launch({ headless: true });
  const popupUrl  = `file://${EXT_DIR}/popup.html`;

  async function renderPopup(settings, pageParam) {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(buildInitScript(MOCK_CLICKS, MOCK_DEFAULT_ID, settings));
    const url = pageParam ? `${popupUrl}?page=${pageParam}` : popupUrl;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const buf = await screenshotPopup(page);
    await ctx.close();
    return buf;
  }

  console.log('Rendering RU-2 (popup light)…');
  const lightList     = await renderPopup(MOCK_SETTINGS_LIGHT, null);
  const lightSettings = await renderPopup(MOCK_SETTINGS_LIGHT, 'settings');
  await compose(lightList, lightSettings, path.join(OUT_DIR, 'RU-2.png'), false);

  console.log('Rendering RU-3 (popup dark)…');
  const darkList     = await renderPopup(MOCK_SETTINGS_DARK, null);
  const darkSettings = await renderPopup(MOCK_SETTINGS_DARK, 'settings');
  await compose(darkList, darkSettings, path.join(OUT_DIR, 'RU-3.png'), true);

  await browser.close();

  // Flatten RGBA → 24-bit RGB via Pillow (node-canvas on macOS always writes RGBA)
  const files = ['RU-1.png', 'RU-2.png', 'RU-3.png']
    .map(f => path.join(OUT_DIR, f).replace(/'/g, "\\'"))
    .join("','");
  execSync(
    `python3 -c "from PIL import Image; [Image.open(p).convert('RGB').save(p,'PNG') for p in ['${files}']]"`,
    { stdio: 'inherit' }
  );
  console.log('Converted to 24-bit RGB.');
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
