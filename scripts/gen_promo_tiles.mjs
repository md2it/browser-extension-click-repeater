/**
 * Generate Chrome Web Store promo tiles:
 *   PUBLICATION/promo-small.png    — 440×280
 *   PUBLICATION/promo-marquee.png  — 1400×560
 */

import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_PATH = path.resolve(__dirname, '../extension/icons/icon-128.png');
const OUT_DIR   = path.resolve(__dirname, '../PUBLICATION');

// ── Background ─────────────────────────────────────────────────────────────────

function drawBackground(ctx, W, H, sceneX) {
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, '#0b0f1a');
  base.addColorStop(1, '#131c2e');
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);

  const gx = sceneX + (W - sceneX) * 0.5, gy = H * 0.42;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.55);
  glow.addColorStop(0,   'rgba(37,99,235,0.12)');
  glow.addColorStop(0.5, 'rgba(37,99,235,0.04)');
  glow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,   r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r,     r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,     x + r, y,          r);
  ctx.closePath();
}

// Cursor: softer stroke — same hue as fill, much lower contrast between them
function drawCursor(ctx, cx, cy, size = 20, alpha = 1) {
  const s = size / 24;
  const ox = cx - 4 * s, oy = cy - 4 * s;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = '#ff6060';
  ctx.strokeStyle = 'rgba(255,140,140,0.55)'; // same hue, light — no harsh dark outline
  ctx.lineWidth   = 1.0 * (size / 20);
  ctx.beginPath();
  ctx.moveTo(ox +  4     * s, oy +  4     * s);
  ctx.lineTo(ox + 11.07  * s, oy + 21     * s);
  ctx.lineTo(ox + 13.58  * s, oy + 13.61  * s);
  ctx.lineTo(ox + 21     * s, oy + 11.07  * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

// Stronger ripples: higher alpha, thicker stroke
function drawRipples(ctx, cx, cy, size) {
  ctx.save();
  for (const [r, a, lw] of [
    [size * 1.5, 0.55, 2.0],
    [size * 2.3, 0.32, 1.8],
    [size * 3.2, 0.16, 1.4],
  ]) {
    ctx.strokeStyle = `rgba(255,80,80,${a})`;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Stronger ghost traces: 0.38 opacity
function drawTrace(ctx, p1, p2, spacing, size) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const n = Math.max(0, Math.round(Math.hypot(dx, dy) / spacing) - 1);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    drawCursor(ctx, p1.x + dx * t, p1.y + dy * t, size, 0.38);
  }
}

// ── UI elements on light card surface ─────────────────────────────────────────
//
// Contrast ratios (all ≥ 4.5:1):
//   card #f8fafc vs dark page bg  → >15:1 ✓
//   btn-primary  #2563eb on card  →  7.6:1 ✓  |  white text on #2563eb → 4.6:1 ✓
//   btn-secondary #334155 on card → 11.4:1 ✓  |  #f8fafc text → 13:1 ✓
//   select border #475569 on #fff →  7.4:1 ✓  |  text #334155 on #fff → 11.4:1 ✓
//   menu bg #1e293b on card       → 12.9:1 ✓  |  inactive #94a3b8 on menu →  7:1 ✓
//                                              |  active #fff on #2563eb  → 4.6:1 ✓

function drawBtnPrimary(ctx, cx, cy, w, h, label, fs) {
  const x = cx - w / 2, y = cy - h / 2, r = 8;
  ctx.save();
  ctx.shadowColor = 'rgba(37,99,235,0.40)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(cx, y, cx, y + h);
  g.addColorStop(0, '#3b82f6'); g.addColorStop(1, '#2563eb');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.font = `600 ${fs}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

function drawBtnSecondary(ctx, cx, cy, w, h, label, fs) {
  const x = cx - w / 2, y = cy - h / 2, r = 8;
  ctx.save();
  ctx.fillStyle = '#334155'; // 11.4:1 vs card
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.fillStyle = '#f8fafc'; ctx.font = `${fs}px Arial`; // 13:1 vs #334155
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

function drawSelect(ctx, cx, cy, w, h, label, fs) {
  const x = cx - w / 2, y = cy - h / 2, r = 8;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; // 7.4:1 vs #fff
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
  ctx.fillStyle = '#334155'; ctx.font = `${fs}px Arial`; // 11.4:1 vs #fff
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 12, cy);
  // chevron ▾
  const chx = x + w - 16;
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(chx-5, cy-2); ctx.lineTo(chx, cy+3); ctx.lineTo(chx+5, cy-2); ctx.stroke();
  ctx.restore();
}

// returns center-y of active item
function drawMenu(ctx, x, y, w, items, activeIdx, itemH, fs) {
  const h = items.length * itemH + 10;
  // Shadow so menu "lifts" off card
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.30)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#1e293b'; // 12.9:1 vs card
  roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 10); ctx.stroke();
  items.forEach((item, i) => {
    const iy = y + 5 + i * itemH;
    if (i === activeIdx) {
      ctx.fillStyle = '#2563eb'; // active bg
      roundRect(ctx, x + 5, iy + 1, w - 10, itemH - 2, 6); ctx.fill();
    }
    if (i > 0) {
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x+14, iy); ctx.lineTo(x+w-14, iy); ctx.stroke();
    }
    ctx.fillStyle     = i === activeIdx ? '#ffffff' : '#94a3b8'; // 4.6:1 / 7:1
    ctx.font          = `${fs}px Arial`;
    ctx.textAlign     = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(item, x + 14, iy + itemH / 2);
  });
  ctx.restore();
  return y + 5 + activeIdx * itemH + itemH / 2;
}

// ── App shell — light card surface ────────────────────────────────────────────
// Card bg #f8fafc vs dark page: >15:1. All content clipped inside card shape.

function drawAppShell(ctx, x, y, w, h, rowH = 38) {
  const r = 12, toolbarH = 44;

  // Card drop-shadow + fill
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 32; ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.restore();

  // Clip everything inside card shape
  ctx.save();
  roundRect(ctx, x, y, w, h, r); ctx.clip();

  // Toolbar strip
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(x, y, w, toolbarH);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + toolbarH); ctx.lineTo(x + w, y + toolbarH); ctx.stroke();

  // Search field
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x + 12, y + 10, 160, 24, 6); ctx.fill();
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
  roundRect(ctx, x + 12, y + 10, 160, 24, 6); ctx.stroke();
  ctx.fillStyle = '#94a3b8'; ctx.font = '12px Arial';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('Search…', x + 24, y + 22);

  // Table rows
  const tY = y + toolbarH + 1, tH = h - toolbarH - 1;
  const numRows = Math.floor(tH / rowH);
  for (let i = 0; i < numRows; i++) {
    const ry = tY + i * rowH;
    if (i % 2 === 1) {
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(x, ry, w, rowH);
    }
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x + 12, ry + rowH); ctx.lineTo(x + w - 12, ry + rowH); ctx.stroke();
    const cols = [x+16, x+w*0.22, x+w*0.46, x+w*0.68];
    const widths = [80, 65, 90, 55];
    cols.forEach((cx2, ci) => {
      const bw = widths[ci] * (0.7 + Math.abs(Math.sin(i * 2.3 + ci)) * 0.3);
      ctx.fillStyle = '#cbd5e1'; // placeholder cells
      roundRect(ctx, cx2, ry + (rowH - 10) / 2, bw, 10, 3); ctx.fill();
    });
  }

  ctx.restore(); // end card clip
}

// ── Brand: logo outer glow (multi-layer) + rounded icon + name ────────────────

// Multi-layer outer glow simulates Photoshop "Outer Glow".
// Each layer is a slightly-larger rounded-rect; layers fade outward.
// textGap must be > maxExpand so glow never overlaps the name.
function drawBrand(ctx, iconImg, cx, cy, iconSize, nameFontSize, textGap) {
  const cr = iconSize * 0.20; // icon corner radius

  // Outer glow layers (all above the text — textGap=28 > maxExpand=22)
  const glowLayers = [
    { expand: 22, alpha: 0.04, color: '200,220,255' },
    { expand: 15, alpha: 0.09, color: '200,220,255' },
    { expand:  9, alpha: 0.17, color: '210,228,255' },
    { expand:  4, alpha: 0.28, color: '220,235,255' },
    { expand:  1, alpha: 0.42, color: '230,240,255' },
  ];
  for (const { expand: ex, alpha, color } of glowLayers) {
    ctx.save();
    ctx.fillStyle = `rgba(${color},${alpha})`;
    roundRect(ctx,
      cx - iconSize / 2 - ex, cy - iconSize / 2 - ex,
      iconSize + ex * 2,      iconSize + ex * 2,
      cr + ex * 0.7
    );
    ctx.fill();
    ctx.restore();
  }

  // Icon clipped to rounded rect
  ctx.save();
  roundRect(ctx, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize, cr);
  ctx.clip();
  ctx.drawImage(iconImg, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
  ctx.restore();

  // Name below icon
  const textY = cy + iconSize / 2 + textGap;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${nameFontSize}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('MACROS',   cx, textY);
  ctx.fillText('REPEATER', cx, textY + nameFontSize + 3);
  ctx.restore();
}

// ── Interactions ──────────────────────────────────────────────────────────────
// Each click: { x, y, rs? } — rs scales the ripple radius (default 1.0),
// varying it per point makes the animation feel "alive".

function drawInteraction(ctx, clicks, cursorSize, traceSpacing) {
  for (let i = 0; i < clicks.length - 1; i++) {
    drawTrace(ctx, clicks[i], clicks[i + 1], traceSpacing, cursorSize);
  }
  for (const c of clicks) {
    drawRipples(ctx, c.x, c.y, cursorSize * (c.rs ?? 1.0));
    drawCursor(ctx, c.x, c.y, cursorSize * 1.15);
  }
}

// ── Save as 24-bit RGB PNG ─────────────────────────────────────────────────────

function saveRGB(canvas, outPath) {
  const rgb  = createCanvas(canvas.width, canvas.height);
  const rctx = rgb.getContext('2d');
  rctx.fillStyle = '#0b0f1a'; rctx.fillRect(0, 0, canvas.width, canvas.height);
  rctx.drawImage(canvas, 0, 0);
  fs.writeFileSync(outPath, rgb.toBuffer('image/png'));
  console.log(`Saved ${outPath}`);
}

// ── Small tile: 440×280 ───────────────────────────────────────────────────────

async function genSmall(iconImg, outPath) {
  const W = 440, H = 280;
  const BRAND_W = 182, SCENE_X = BRAND_W + 8;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  drawBackground(ctx, W, H, SCENE_X);

  const iconSz = 90, textGap = 28, fontSize = 17;
  const brandH = iconSz + textGap + fontSize * 2 + 3;
  const brandCY = Math.round((H - brandH) / 2 + iconSz / 2);
  drawBrand(ctx, iconImg, Math.round(BRAND_W / 2), brandCY, iconSz, fontSize, textGap);

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(SCENE_X - 3, 22); ctx.lineTo(SCENE_X - 3, H - 22); ctx.stroke();

  const sceneW = W - SCENE_X;
  const scx    = SCENE_X + Math.round(sceneW / 2);

  drawAppShell(ctx, SCENE_X + 4, 16, sceneW - 8, H - 32, 30);

  // Button and select — same width, same horizontal center
  const elemW = 142, elemCX = scx - 2;

  const e1 = { x: elemCX, y: 56, rs: 1.20 };
  drawBtnPrimary(ctx, e1.x, e1.y, elemW, 32, 'New Report', 13);

  const e2 = { x: elemCX, y: 143, rs: 0.85 };
  drawSelect(ctx, e2.x, e2.y, elemW, 32, 'Department…', 13);

  const mW = elemW, mItemH = 26, mFS = 12;
  const mX = e2.x - mW / 2 + 2, mY = e2.y + 16 + 4;
  const mItems  = ['All teams', 'Engineering', 'Marketing', 'Sales'];
  const mActive = 2;
  const mCY     = drawMenu(ctx, mX, mY, mW, mItems, mActive, mItemH, mFS);
  const e3 = { x: Math.round(mX + mW / 2), y: Math.round(mCY), rs: 1.05 };

  drawInteraction(ctx, [e1, e2, e3], 19, 50);
  saveRGB(canvas, outPath);
}

// ── Large tile: 1400×560 ──────────────────────────────────────────────────────

async function genLarge(iconImg, outPath) {
  const W = 1400, H = 560;
  const BRAND_W = 376, SCENE_X = BRAND_W + 14;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  drawBackground(ctx, W, H, SCENE_X);

  const iconSz = 152, textGap = 28, fontSize = 34;
  const brandH = iconSz + textGap + fontSize * 2 + 3;
  const brandCY = Math.round((H - brandH) / 2 + iconSz / 2);
  drawBrand(ctx, iconImg, Math.round(BRAND_W / 2), brandCY, iconSz, fontSize, textGap);

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(SCENE_X - 6, 34); ctx.lineTo(SCENE_X - 6, H - 34); ctx.stroke();

  const sx = SCENE_X; // 372
  drawAppShell(ctx, sx + 6, 22, W - sx - 14, H - 44, 40);

  // S-curve: top-left → top-right → center → menu → select → menu item
  const e1 = { x: sx + 128, y: 108, rs: 1.00 };
  drawBtnPrimary(ctx, e1.x, e1.y, 148, 40, 'New Report', 15);

  const e2 = { x: sx + 858, y: 108, rs: 1.35 };
  drawBtnSecondary(ctx, e2.x, e2.y, 132, 40, 'Import CSV', 15);

  const e3 = { x: sx + 510, y: 244, rs: 0.88 };
  drawSelect(ctx, e3.x, e3.y, 162, 40, 'Department…', 15);

  const m1W = 162, m1H = 30, m1FS = 13;
  const m1X = e3.x - m1W / 2 + 2, m1Y = e3.y + 20 + 4;
  const m1Items  = ['All teams', 'Engineering', 'Design', 'Marketing', 'Sales'];
  const m1Active = 3;
  const m1CY     = drawMenu(ctx, m1X, m1Y, m1W, m1Items, m1Active, m1H, m1FS);
  const e4 = { x: Math.round(m1X + m1W / 2), y: Math.round(m1CY), rs: 1.18 };

  const e5 = { x: sx + 760, y: 398, rs: 0.82 };
  drawSelect(ctx, e5.x, e5.y, 168, 40, 'Date range…', 15);

  const m2W = 182, m2H = 30, m2FS = 13;
  const m2X = e5.x - m2W / 2 + 2, m2Y = e5.y + 20 + 4;
  const m2Items  = ['Today', 'Last 7 days', 'Last 30 days', 'Custom…'];
  const m2Active = 2;
  const m2CY     = drawMenu(ctx, m2X, m2Y, m2W, m2Items, m2Active, m2H, m2FS);
  const e6 = { x: Math.round(m2X + m2W / 2), y: Math.round(m2CY), rs: 1.12 };

  drawInteraction(ctx, [e1, e2, e3, e4, e5, e6], 28, 75);
  saveRGB(canvas, outPath);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const iconImg = await loadImage(ICON_PATH);
  console.log('Generating promo-small.png (440×280)…');
  await genSmall(iconImg, path.join(OUT_DIR, 'promo-small.png'));
  console.log('Generating promo-marquee.png (1400×560)…');
  await genLarge(iconImg, path.join(OUT_DIR, 'promo-marquee.png'));
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
