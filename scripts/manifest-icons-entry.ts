import { join } from "node:path";

declare const OffscreenCanvas: new (w: number, h: number) => {
  getContext(type: "2d"): any;
};
declare const Path2D: new (d: string) => any;

const CATALOG_ROOT: string = (process.env as any).CATALOG_ROOT;
const ICON_SVG_PATH = join(CATALOG_ROOT, "lib/icons/extension-logos/click-repeater/icon.svg");

const SIZES = [16, 32, 48, 128];
const BG = "#012292";
const FG = "#ffffff";

const ICON_PATHS = [
  "m4 4 7.07 17 2.51-7.39L21 11.07z",
];

function renderIcon(size: number): { size: number; data: Buffer } {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const scale = size / 24;

  ctx.fillStyle = BG;
  const r = size * 3 / 24;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.arcTo(size, 0, size, r, r);
  ctx.lineTo(size, size - r);
  ctx.arcTo(size, size, size - r, size, r);
  ctx.lineTo(r, size);
  ctx.arcTo(0, size, 0, size - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = FG;
  ctx.strokeStyle = FG;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const d of ICON_PATHS) {
    const p = new Path2D(d);
    ctx.fill(p);
    ctx.stroke(p);
  }

  ctx.restore();

  const imageData = ctx.getImageData(0, 0, size, size);
  return { size, data: Buffer.from(imageData.data.buffer) };
}

export function getInactiveManifestRasters() {
  return SIZES.map(renderIcon);
}

export const manifestIconOutputs = [
  {
    prefix: "icon",
    getRasters: getInactiveManifestRasters,
    svgPath: ICON_SVG_PATH,
  },
];
