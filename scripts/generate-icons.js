// Generates the PWA icons as PNGs with zero dependencies.
// Run: node scripts/generate-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---- minimal PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(filename, size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      raw[off++] = r; raw[off++] = g; raw[off++] = b; raw[off++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filename, png);
  console.log(`${filename} (${(png.length / 1024).toFixed(1)} KB)`);
}

// ---- shape helpers (normalized 0..1 coords, signed distance style) ----
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - cx, dy = y - cy;
  if (x >= x0 + r && x <= x1 - r) return y >= y0 && y <= y1;
  if (y >= y0 + r && y <= y1 - r) return x >= x0 && x <= x1;
  return dx * dx + dy * dy <= r * r;
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ---- the icon ----
// Indigo gradient rounded square, white wallet, amber coin.
function drawIcon(u, v, opts) {
  const { maskable } = opts;
  // Maskable icons must fill the full square; content shrinks into the safe zone.
  const scale = maskable ? 0.78 : 1.0;
  const ox = (1 - scale) / 2;
  const x = (u - ox) / scale;
  const y = (v - ox) / scale;

  const bgRadius = maskable ? 0 : 0.21;
  const inBg = maskable ? true : inRoundedRect(u, v, 0.02, 0.02, 0.98, 0.98, bgRadius);
  if (!inBg) return [0, 0, 0, 0];

  // gradient background: #7c83f7 (top) -> #4f46e5 (bottom)
  let R = Math.round(lerp(0x7c, 0x4f, v));
  let G = Math.round(lerp(0x83, 0x46, v));
  let B = Math.round(lerp(0xf7, 0xe5, v));

  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
    const wallet = inRoundedRect(x, y, 0.18, 0.30, 0.82, 0.74, 0.07);
    const flap = inRoundedRect(x, y, 0.18, 0.30, 0.82, 0.44, 0.07);
    const slot = inRoundedRect(x, y, 0.26, 0.50, 0.50, 0.555, 0.025);
    const coinOuter = inCircle(x, y, 0.665, 0.585, 0.115);
    const coinInner = inCircle(x, y, 0.665, 0.585, 0.085);

    if (coinOuter && !coinInner && wallet) { R = 0xd9; G = 0x77; B = 0x06; }       // coin ring
    else if (coinInner) { R = 0xf5; G = 0x9e; B = 0x0b; }                          // coin face
    else if (slot) { R = 0xc7; G = 0xd2; B = 0xfe; }                               // card slot
    else if (flap) { R = 0xe2; G = 0xe8; B = 0xf0; }                               // wallet flap
    else if (wallet) { R = 0xf8; G = 0xfa; B = 0xfc; }                             // wallet body
  }

  return [R, G, B, 255];
}

// 2x supersampling for smooth edges
function render(size, opts) {
  return (px, py) => {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < 2; sy++) {
      for (let sx = 0; sx < 2; sx++) {
        const [pr, pg, pb, pa] = drawIcon((px + (sx + 0.5) / 2) / size, (py + (sy + 0.5) / 2) / size, opts);
        r += pr; g += pg; b += pb; a += pa;
      }
    }
    return [Math.round(r / 4), Math.round(g / 4), Math.round(b / 4), Math.round(a / 4)];
  };
}

const outDir = path.join(__dirname, '../client/public');
writePng(path.join(outDir, 'icon-192.png'), 192, render(192, { maskable: false }));
writePng(path.join(outDir, 'icon-512.png'), 512, render(512, { maskable: false }));
writePng(path.join(outDir, 'icon-180.png'), 180, render(180, { maskable: false }));
writePng(path.join(outDir, 'icon-maskable-192.png'), 192, render(192, { maskable: true }));
writePng(path.join(outDir, 'icon-maskable-512.png'), 512, render(512, { maskable: true }));
