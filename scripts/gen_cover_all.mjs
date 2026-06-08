/**
 * Generate cover screenshots for all supported locales:
 *   PUBLICATION/screenshots/{LANG}-0.png  — 1280×800 RGB
 *
 * Composition: promo-tile style (dark bg + brand left + localized scene right).
 * Placed before {LANG}-1/2/3 in the store gallery.
 *
 * Cursor / ripples match the real extension tracker:
 *   cursor  — fill #ffffff, stroke #012292
 *   ripples — 5 rings [#012292, white, #012292, white, #012292], snapshot t=280ms
 */

import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_PATH = path.resolve(__dirname, '../extension/icons/icon-128.png');
const OUT_DIR   = path.resolve(__dirname, '../PUBLICATION/screenshots');

const W = 1280, H = 800;

// ── Per-locale UI strings for the scene ───────────────────────────────────────

const LOCALE_CONFIGS = [
  {
    code: 'EN',
    search:      'Search…',
    btnPrimary:  'New Report',
    btnSecondary:'Import CSV',
    selectDept:  'Department…',
    deptItems:   ['All teams', 'Engineering', 'Design', 'Marketing', 'Sales'],
    deptActive:  3,
    selectDate:  'Date range…',
    dateItems:   ['Today', 'Last 7 days', 'Last 30 days', 'Custom…'],
    dateActive:  2,
  },
  {
    code: 'ES',
    search:      'Buscar…',
    btnPrimary:  'Nuevo informe',
    btnSecondary:'Importar CSV',
    selectDept:  'Departamento…',
    deptItems:   ['Todos los equipos', 'Ingeniería', 'Diseño', 'Marketing', 'Ventas'],
    deptActive:  3,
    selectDate:  'Período…',
    dateItems:   ['Hoy', 'Últimos 7 días', 'Últimos 30 días', 'Personalizado'],
    dateActive:  2,
  },
  {
    code: 'FR',
    search:      'Rechercher…',
    btnPrimary:  'Nouveau rapport',
    btnSecondary:'Importer CSV',
    selectDept:  'Département…',
    deptItems:   ['Toutes les équipes', 'Ingénierie', 'Design', 'Marketing', 'Ventes'],
    deptActive:  3,
    selectDate:  'Période…',
    dateItems:   ["Aujourd'hui", '7 derniers jours', '30 derniers jours', 'Personnalisé'],
    dateActive:  2,
  },
  {
    code: 'DE',
    search:      'Suchen…',
    btnPrimary:  'Neuer Bericht',
    btnSecondary:'CSV importieren',
    selectDept:  'Abteilung…',
    deptItems:   ['Alle Teams', 'Engineering', 'Design', 'Marketing', 'Vertrieb'],
    deptActive:  3,
    selectDate:  'Zeitraum…',
    dateItems:   ['Heute', 'Letzte 7 Tage', 'Letzte 30 Tage', 'Benutzerdefiniert'],
    dateActive:  2,
  },
  {
    code: 'RU',
    search:      'Поиск…',
    btnPrimary:  'Новый отчёт',
    btnSecondary:'Импорт CSV',
    selectDept:  'Отдел…',
    deptItems:   ['Все отделы', 'Инженерия', 'Дизайн', 'Маркетинг', 'Продажи'],
    deptActive:  3,
    selectDate:  'Период…',
    dateItems:   ['Сегодня', 'За 7 дней', 'За 30 дней', 'Свой период'],
    dateActive:  2,
  },
  {
    code: 'ZH',
    search:      '搜索…',
    btnPrimary:  '新建报告',
    btnSecondary:'导入 CSV',
    selectDept:  '部门…',
    deptItems:   ['所有团队', '工程', '设计', '市场营销', '销售'],
    deptActive:  3,
    selectDate:  '日期范围…',
    dateItems:   ['今天', '最近 7 天', '最近 30 天', '自定义'],
    dateActive:  2,
  },
  {
    code: 'AR',
    search:      'بحث…',
    btnPrimary:  'تقرير جديد',
    btnSecondary:'استيراد CSV',
    selectDept:  'القسم…',
    deptItems:   ['جميع الفرق', 'الهندسة', 'التصميم', 'التسويق', 'المبيعات'],
    deptActive:  3,
    selectDate:  'نطاق التاريخ…',
    dateItems:   ['اليوم', 'آخر 7 أيام', 'آخر 30 يومًا', 'مخصص'],
    dateActive:  2,
  },
];

// ── Background ─────────────────────────────────────────────────────────────────

function drawBackground(ctx, sceneX) {
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

// ── Cursor & ripples — match real extension tracker ────────────────────────────

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
  ctx.moveTo(ox +  4    * s, oy +  4    * s);
  ctx.lineTo(ox + 11.07 * s, oy + 21    * s);
  ctx.lineTo(ox + 13.58 * s, oy + 13.61 * s);
  ctx.lineTo(ox + 21    * s, oy + 11.07 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

// spawnClickRipple(): 5 rings [#012292, white, #012292, white, #012292],
// diameter 60–100px, delay i×60ms, duration 500ms. Snapshot at t=280ms.
function drawRipples(ctx, cx, cy, scale = 1.0) {
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

function drawTrace(ctx, p1, p2, spacing, size) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const n = Math.max(0, Math.round(Math.hypot(dx, dy) / spacing) - 1);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    drawCursor(ctx, p1.x + dx * t, p1.y + dy * t, size, 0.30);
  }
}

function drawInteraction(ctx, clicks, cursorSize, traceSpacing) {
  for (let i = 0; i < clicks.length - 1; i++) {
    drawTrace(ctx, clicks[i], clicks[i + 1], traceSpacing, cursorSize);
  }
  for (const c of clicks) {
    drawRipples(ctx, c.x, c.y, (cursorSize / 36) * (c.rs ?? 1.0));
    drawCursor(ctx, c.x, c.y, cursorSize * 1.5);
  }
}

// ── UI elements ────────────────────────────────────────────────────────────────

function drawBtnPrimary(ctx, cx, cy, w, h, label, fs) {
  const x = cx - w / 2, y = cy - h / 2, r = 8;
  ctx.save();
  ctx.shadowColor = 'rgba(37,99,235,0.40)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
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
  ctx.fillStyle = '#334155';
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.fillStyle = '#f8fafc'; ctx.font = `${fs}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

function drawSelect(ctx, cx, cy, w, h, label, fs) {
  const x = cx - w / 2, y = cy - h / 2, r = 8;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
  ctx.fillStyle = '#334155'; ctx.font = `${fs}px Arial`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 14, cy);
  const chx = x + w - 18;
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(chx-5, cy-2); ctx.lineTo(chx, cy+3); ctx.lineTo(chx+5, cy-2); ctx.stroke();
  ctx.restore();
}

function drawMenu(ctx, x, y, w, items, activeIdx, itemH, fs) {
  const h = items.length * itemH + 12;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.30)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 10); ctx.stroke();
  items.forEach((item, i) => {
    const iy = y + 6 + i * itemH;
    if (i === activeIdx) {
      ctx.fillStyle = '#2563eb';
      roundRect(ctx, x + 5, iy + 1, w - 10, itemH - 2, 6); ctx.fill();
    }
    if (i > 0) {
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x+14, iy); ctx.lineTo(x+w-14, iy); ctx.stroke();
    }
    ctx.fillStyle     = i === activeIdx ? '#ffffff' : '#94a3b8';
    ctx.font          = `${fs}px Arial`;
    ctx.textAlign     = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(item, x + 16, iy + itemH / 2);
  });
  ctx.restore();
  return y + 6 + activeIdx * itemH + itemH / 2;
}

// ── App shell ──────────────────────────────────────────────────────────────────

function drawAppShell(ctx, x, y, w, h, searchLabel, rowH = 44) {
  const r = 14, toolbarH = 52;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, r); ctx.clip();

  ctx.fillStyle = '#f1f5f9'; ctx.fillRect(x, y, w, toolbarH);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + toolbarH); ctx.lineTo(x + w, y + toolbarH); ctx.stroke();

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x + 16, y + 13, 200, 28, 6); ctx.fill();
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
  roundRect(ctx, x + 16, y + 13, 200, 28, 6); ctx.stroke();
  ctx.fillStyle = '#94a3b8'; ctx.font = '14px Arial';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(searchLabel, x + 30, y + 27);

  const tY = y + toolbarH + 1, tH = h - toolbarH - 1;
  const numRows = Math.floor(tH / rowH);
  const cols   = [x+18, x+w*0.22, x+w*0.46, x+w*0.68];
  const widths = [100, 80, 110, 70];
  for (let i = 0; i < numRows; i++) {
    const ry = tY + i * rowH;
    if (i % 2 === 1) { ctx.fillStyle = '#f1f5f9'; ctx.fillRect(x, ry, w, rowH); }
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x + 14, ry + rowH); ctx.lineTo(x + w - 14, ry + rowH); ctx.stroke();
    cols.forEach((cx2, ci) => {
      const bw = widths[ci] * (0.65 + Math.abs(Math.sin(i * 2.3 + ci)) * 0.35);
      ctx.fillStyle = '#cbd5e1';
      roundRect(ctx, cx2, ry + (rowH - 12) / 2, bw, 12, 3); ctx.fill();
    });
  }
  ctx.restore();
}

// ── Brand ──────────────────────────────────────────────────────────────────────

function drawBrand(ctx, iconImg, cx, cy, iconSize, nameFontSize, textGap) {
  const cr = iconSize * 0.20;
  const glowLayers = [
    { expand: 26, alpha: 0.04, color: '200,220,255' },
    { expand: 18, alpha: 0.09, color: '200,220,255' },
    { expand: 11, alpha: 0.17, color: '210,228,255' },
    { expand:  5, alpha: 0.28, color: '220,235,255' },
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
  ctx.save();
  roundRect(ctx, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize, cr);
  ctx.clip();
  ctx.drawImage(iconImg, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
  ctx.restore();

  const textY = cy + iconSize / 2 + textGap;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${nameFontSize}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('CLICK',    cx, textY);
  ctx.fillText('REPEATER', cx, textY + nameFontSize + 4);
  ctx.restore();
}

// ── Save as 24-bit RGB PNG ─────────────────────────────────────────────────────

function saveRGB(canvas, outPath) {
  const rgb  = createCanvas(W, H);
  const rctx = rgb.getContext('2d');
  rctx.fillStyle = '#0b0f1a'; rctx.fillRect(0, 0, W, H);
  rctx.drawImage(canvas, 0, 0);
  fs.writeFileSync(outPath, rgb.toBuffer('image/png'));
}

// ── Render one cover ───────────────────────────────────────────────────────────

function renderCover(ctx, iconImg, cfg) {
  const BRAND_W = 330, SCENE_X = BRAND_W + 16;

  drawBackground(ctx, SCENE_X);

  const iconSz = 160, textGap = 30, fontSize = 36;
  const brandH  = iconSz + textGap + fontSize * 2 + 4;
  const brandCY = Math.round((H - brandH) / 2 + iconSz / 2);
  drawBrand(ctx, iconImg, Math.round(BRAND_W / 2), brandCY, iconSz, fontSize, textGap);

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(SCENE_X - 6, 36); ctx.lineTo(SCENE_X - 6, H - 36); ctx.stroke();

  const sx = SCENE_X;
  const shellX = sx + 8, shellY = 28, shellW = W - sx - 36, shellH = H - 56;
  drawAppShell(ctx, shellX, shellY, shellW, shellH, cfg.search, 44);

  // S-curve: 6 click points
  const e1 = { x: sx + 120, y: 120, rs: 1.00 };
  drawBtnPrimary(ctx, e1.x, e1.y, 162, 44, cfg.btnPrimary, 15);

  const e2 = { x: sx + 750, y: 120, rs: 1.35 };
  drawBtnSecondary(ctx, e2.x, e2.y, 150, 44, cfg.btnSecondary, 15);

  const e3 = { x: sx + 440, y: 310, rs: 0.88 };
  drawSelect(ctx, e3.x, e3.y, 180, 44, cfg.selectDept, 15);

  const m1W = 192, m1H = 34, m1FS = 13;
  const m1X = e3.x - m1W / 2 + 2, m1Y = e3.y + 22 + 4;
  const m1CY = drawMenu(ctx, m1X, m1Y, m1W, cfg.deptItems, cfg.deptActive, m1H, m1FS);
  const e4 = { x: Math.round(m1X + m1W / 2), y: Math.round(m1CY), rs: 1.18 };

  const e5 = { x: sx + 680, y: 520, rs: 0.82 };
  drawSelect(ctx, e5.x, e5.y, 192, 44, cfg.selectDate, 15);

  const m2W = 210, m2H = 34, m2FS = 13;
  const m2X = e5.x - m2W / 2 + 2, m2Y = e5.y + 22 + 4;
  const m2CY = drawMenu(ctx, m2X, m2Y, m2W, cfg.dateItems, cfg.dateActive, m2H, m2FS);
  const e6 = { x: Math.round(m2X + m2W / 2), y: Math.round(m2CY), rs: 1.12 };

  drawInteraction(ctx, [e1, e2, e3, e4, e5, e6], 32, 80);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const iconImg = await loadImage(ICON_PATH);
  const generated = [];

  for (const cfg of LOCALE_CONFIGS) {
    const outPath = path.join(OUT_DIR, `${cfg.code}-0.png`);
    console.log(`Rendering ${cfg.code}-0…`);

    const canvas = createCanvas(W, H);
    renderCover(canvas.getContext('2d'), iconImg, cfg);
    saveRGB(canvas, outPath);
    generated.push(outPath);
    console.log(`  Saved ${cfg.code}-0.png`);
  }

  // Flatten RGBA → 24-bit RGB via Pillow
  const fileList = generated.map(p => p.replace(/'/g, "\\'")).join("','");
  execSync(
    `python3 -c "from PIL import Image; [Image.open(p).convert('RGB').save(p,'PNG') for p in ['${fileList}']]"`,
    { stdio: 'inherit' }
  );
  console.log('Converted to 24-bit RGB.');
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
