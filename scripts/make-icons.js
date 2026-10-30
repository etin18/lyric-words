/**
 * 產生 PWA 圖示（純 Node 手寫 PNG，不依賴套件）
 * 執行：node scripts/make-icons.js
 * 圖案：粉紫漸層底＋白色雙八分音符（♫）。圖案落在中心安全區內，可當 maskable icon。
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, px) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* 圖案（座標 0~1）：兩顆斜的橢圓音符頭、兩根符桿、一條斜的符槓 */
const A = (-22 * Math.PI) / 180;
function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = x - cx, dy = y - cy;
  const u = dx * Math.cos(A) + dy * Math.sin(A), v = -dx * Math.sin(A) + dy * Math.cos(A);
  return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
}
const inRect = (x, y, x0, x1, y0, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
function inBeam(x, y) {
  const x0 = 0.405, x1 = 0.745;
  if (x < x0 || x > x1) return false;
  const top = 0.285 + ((x - x0) / (x1 - x0)) * (0.215 - 0.285);   // 右邊比左邊高一點
  return y >= top && y <= top + 0.085;
}
function inNote(x, y) {
  return inEllipse(x, y, 0.33, 0.70, 0.098, 0.07) ||
    inEllipse(x, y, 0.67, 0.63, 0.098, 0.07) ||
    inRect(x, y, 0.405, 0.44, 0.30, 0.69) ||
    inRect(x, y, 0.71, 0.745, 0.23, 0.62) ||
    inBeam(x, y);
}

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 3;   // 超取樣，邊緣才不會鋸齒
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size);
      // 左上粉、右下紫（同追星記帳本的色系）
      const bg = [255 - 115 * t, 143 - 58 * t, 208 - 8 * t].map(Math.round);
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        if (inNote((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)) hit++;
      }
      const a = hit / (SS * SS);
      const o = (y * size + x) * 4;
      px[o] = Math.round(bg[0] * (1 - a) + 255 * a);
      px[o + 1] = Math.round(bg[1] * (1 - a) + 255 * a);
      px[o + 2] = Math.round(bg[2] * (1 - a) + 255 * a);
      px[o + 3] = 255;
    }
  }
  return px;
}

const out = path.join(__dirname, '..', 'www', 'icons');
fs.mkdirSync(out, { recursive: true });
[180, 192, 512].forEach((s) => { fs.writeFileSync(path.join(out, `icon-${s}.png`), encodePng(s, draw(s))); console.log('icon-' + s + '.png'); });
