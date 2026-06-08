/**
 * Generate localized screenshots for ES, FR, DE, RU, ZH, AR.
 * Produces [LOCALE]-1.png, [LOCALE]-2.png, [LOCALE]-3.png per locale.
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

// Per-locale config: storage locale key, translated click names, md2it URL
const LOCALE_CONFIGS = [
  {
    code: 'ES',
    storageLocale: 'es',
    customTitle: 'Título personalizado',
    firstClick: 'Mis primeros clics',
    md2itPath: '/es/',
    md2itFallback: '/en/',
  },
  {
    code: 'FR',
    storageLocale: 'fr',
    customTitle: 'Titre personnalisé',
    firstClick: 'Mes premiers clics',
    md2itPath: '/fr/',
    md2itFallback: '/en/',
  },
  {
    code: 'DE',
    storageLocale: 'de',
    customTitle: 'Benutzerdefinierter Titel',
    firstClick: 'Meine ersten Klicks',
    md2itPath: '/de/',
    md2itFallback: '/en/',
  },
  {
    code: 'RU',
    storageLocale: 'ru',
    customTitle: 'Свой заголовок',
    firstClick: 'Мои первые нажатия',
    md2itPath: '/ru/',
    md2itFallback: '/en/',
  },
  {
    code: 'ZH',
    storageLocale: 'zh_CN',
    customTitle: '自定义标题',
    firstClick: '我的第一次点击',
    md2itPath: '/zh/',
    md2itFallback: '/en/',
  },
  {
    code: 'AR',
    storageLocale: 'ar',
    customTitle: 'عنوان مخصص',
    firstClick: 'أول نقراتي',
    md2itPath: '/ar/',
    md2itFallback: '/en/',
  },
];

const MOCK_DEFAULT_ID = 'click-001';

function buildClicks(customTitle, firstClick) {
  return [
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
      name: customTitle,
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
      name: firstClick,
      repeats: 1,
      displayMoves: true,
      trackMoves: true,
      mode: 'position',
      steps: [{ position: '640,400' }]
    }
  ];
}

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

      globalThis.chrome = { storage: { local: mockStorage }, runtime: mockRuntime, tabs: mockTabs };
      globalThis.browser = undefined;
    })();
  `;
}

async function screenshotPopup(page) {
  const box = await page.locator('.popup-shell').boundingBox();
  if (!box) throw new Error('popup-shell not found');
  return page.screenshot({
    clip: { x: box.x, y: box.y, width: box.width, height: box.height }
  });
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

async function compose(leftBuf, rightBuf, outputPath, dark) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  if (dark) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);
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

  ctx.fillStyle = dark ? '#1a2035' : '#f0f1f5';
  ctx.fillRect(0, 0, W, 40);
  ctx.strokeStyle = dark ? '#2a3450' : '#d0d3e0';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(W, 40); ctx.stroke();

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

  const leftImg = await loadImage(leftBuf);
  const rightImg = await loadImage(rightBuf);

  const totalW = leftImg.width + rightImg.width + 40;
  const startX = Math.max(0, (W - totalW) / 2);
  const startY = Math.max(0, (H - 40 - Math.max(leftImg.height, rightImg.height)) / 2) + 40;

  ctx.save();
  ctx.shadowColor = dark ? 'rgba(160,185,255,0.45)' : 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = dark ? 36 : 24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = dark ? 0 : 6;
  ctx.fillStyle = 'rgba(0,0,0,0.01)';
  roundRect(ctx, startX, startY, leftImg.width, leftImg.height, 12);
  ctx.fill();
  roundRect(ctx, startX + leftImg.width + 40, startY, rightImg.width, rightImg.height, 12);
  ctx.fill();
  ctx.restore();

  drawRounded(ctx, leftImg, startX, startY, leftImg.width, leftImg.height, 12);
  drawRounded(ctx, rightImg, startX + leftImg.width + 40, startY, rightImg.width, rightImg.height, 12);

  // subtle border to separate windows from dark background
  if (dark) {
    ctx.save();
    ctx.strokeStyle = 'rgba(100,120,200,0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, startX, startY, leftImg.width, leftImg.height, 12);
    ctx.stroke();
    roundRect(ctx, startX + leftImg.width + 40, startY, rightImg.width, rightImg.height, 12);
    ctx.stroke();
    ctx.restore();
  }

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  console.log(`Saved ${outputPath}`);
}

function drawCursor(ctx, cx, cy, size = 18, alpha = 1) {
  const scale = size / 24;
  const ox = cx - 4 * scale;
  const oy = cy - 4 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgb(220,20,20)';
  ctx.strokeStyle = 'rgba(130,0,0,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ox + 4 * scale,     oy + 4     * scale);
  ctx.lineTo(ox + 11.07 * scale, oy + 21    * scale);
  ctx.lineTo(ox + 13.58 * scale, oy + 13.61 * scale);
  ctx.lineTo(ox + 21 * scale,    oy + 11.07 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

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

async function genSlide3(outputPath, md2itUrl) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setViewportSize({ width: W, height: H });

  let usedUrl = md2itUrl;
  try {
    const resp = await page.goto(md2itUrl, { waitUntil: 'networkidle', timeout: 30000 });
    if (!resp || resp.status() >= 400) {
      // fallback to /en/
      usedUrl = 'https://www.md2it.com/en/';
      await page.goto(usedUrl, { waitUntil: 'networkidle', timeout: 30000 });
    }
  } catch {
    usedUrl = 'https://www.md2it.com/en/';
    await page.goto(usedUrl, { waitUntil: 'networkidle', timeout: 30000 });
  }

  const summarySpanRect = await page.evaluate(() => {
    const el = document.querySelector('body > header > div > details > summary > span');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  const c1 = { x: Math.round(W * 0.38), y: Math.round(H * 0.52) };
  const c2 = summarySpanRect || { x: W - 80, y: 28 };

  await page.evaluate(() => {
    const el = document.querySelector('body > header > div > details');
    if (el) el.setAttribute('open', '');
  });
  await page.waitForTimeout(300);

  const li4Rect = await page.evaluate(() => {
    const el = document.querySelector('body > header > div > details > ul > li:nth-child(4) > a');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const c3 = li4Rect || { x: W - 80, y: 120 };

  const pageScreenshot = await page.screenshot();
  await browser.close();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const bgImg = await loadImage(pageScreenshot);
  ctx.drawImage(bgImg, 0, 0, W, H);

  function interp(p1, p2, n = 4) {
    const pts = [];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      pts.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
    }
    return pts;
  }

  const traceAlpha = 0.2;
  const tracePoints = [...interp(c1, c2, 12), ...interp(c2, c3, 4)];
  for (const pt of tracePoints) {
    drawCursor(ctx, pt.x, pt.y, 28, traceAlpha);
  }

  for (const c of [c1, c2, c3]) {
    drawClickRipples(ctx, c.x, c.y, 28, 1);
    drawCursor(ctx, c.x, c.y, 32, 1);
  }

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

  const popupUrl = `file://${EXT_DIR}/popup.html`;
  const settingsBase = {
    executionSpeed: 1,
    skipNewMacroExplanation: false,
    skipDisplayMovesExplanation: true,
    skipModeExplanation: false,
  };

  for (const cfg of LOCALE_CONFIGS) {
    console.log(`\n── ${cfg.code} ──────────────────────────────────────`);
    const clicks = buildClicks(cfg.customTitle, cfg.firstClick);
    const settingsLight = { ...settingsBase, darkTheme: false };
    const settingsDark  = { ...settingsBase, darkTheme: true };
    const locale = cfg.storageLocale;

    const browser = await chromium.launch({ headless: true });

    async function renderPopup(settings, pageParam) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.addInitScript(buildInitScript(clicks, MOCK_DEFAULT_ID, settings, locale));
      const url = pageParam ? `${popupUrl}?page=${pageParam}` : popupUrl;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      const buf = await screenshotPopup(page);
      await ctx.close();
      return buf;
    }

    // -1: light
    console.log(`  ${cfg.code}-1 (light)…`);
    const lightList    = await renderPopup(settingsLight, null);
    const lightSettings  = await renderPopup(settingsLight, 'settings');
    await compose(lightList, lightSettings, path.join(OUT_DIR, `${cfg.code}-1.png`), false);

    // -2: dark
    console.log(`  ${cfg.code}-2 (dark)…`);
    const darkList    = await renderPopup(settingsDark, null);
    const darkSettings  = await renderPopup(settingsDark, 'settings');
    await compose(darkList, darkSettings, path.join(OUT_DIR, `${cfg.code}-2.png`), true);

    await browser.close();

    // -3: md2it.com
    console.log(`  ${cfg.code}-3 (md2it.com)…`);
    const md2itUrl = `https://www.md2it.com${cfg.md2itPath}`;
    await genSlide3(path.join(OUT_DIR, `${cfg.code}-3.png`), md2itUrl);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
