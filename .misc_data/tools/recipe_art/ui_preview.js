// Mock-up of a recipe book page: drawing at the in-game scale plus the vanilla ingredient circle sprites.
// Measured in game (2026-10-03): the drawing is shown at 0.867 of its pixel size, and a circle's ring centre sits at
// image origin + (PosX - 13, PosY + 40) in the same units as PosX/PosY. The sprites are drawn 1:1 around that centre.
// node ui_preview.js out.png drawing.png "PosX,PosY,Dir;PosX,PosY,Dir"   (Dir: North, NorthEast, ... NorthWest)
const { decode, encode } = require('./png.js');
const path = require('path');
// sprites: vanilla data/ui/2kimages/main/assets/recipebook/circle_pointer/recipebook_arrow_NN_0.dds converted to PNG with texconv
const SPR = process.env.ARROWS || path.join(__dirname, 'out/arrows');
const K = 0.867, BASE = [-13, 40];
// sprite variants per direction: [file number, ring centre x, y] (fitted from the textures)
const VAR = {
  North: [[1, 47, 102], [2, 42, 86]], NorthEast: [[3, 37, 58], [4, 43, 62]], East: [[5, 38, 40], [6, 38, 35]],
  SouthEast: [[8, 38, 40], [7, 35, 36]], South: [[9, 40, 50], [10, 45, 40], [11, 46, 52]], SouthWest: [[12, 65, 48], [13, 47, 39]],
  West: [[14, 90, 45], [15, 72, 49]], NorthWest: [[16, 65, 62], [17, 62, 63]],
};
const [, , outF, drawF, spec] = process.argv;
const D = decode(drawF);
const PW = 600, PH = 560, OX = 110, OY = 70; // page canvas and image origin on it
const out = Buffer.alloc(PW * PH * 4);
for (let i = 0; i < PW * PH; i++) { out[i * 4] = 233; out[i * 4 + 1] = 220; out[i * 4 + 2] = 192; out[i * 4 + 3] = 255; }
const blend = (x, y, r, g, b, a) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= PW || y >= PH || a <= 0) return; const i = (y * PW + x) * 4; out[i] = out[i] * (1 - a) + r * a; out[i + 1] = out[i + 1] * (1 - a) + g * a; out[i + 2] = out[i + 2] * (1 - a) + b * a; };
// drawing, bilinear at scale K
const sample = (u, v) => { const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y; let a = 0; for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < D.w && Y < D.h) a += D.data[(Y * D.w + X) * 4 + 3] * w; } return a / 255; };
for (let y = 0; y < D.h * K; y++) for (let x = 0; x < D.w * K; x++) blend(OX + x, OY + y, 58, 36, 29, sample(x / K, y / K));
// image frame
for (let x = 0; x < D.w * K; x++) { blend(OX + x, OY, 160, 120, 90, 0.5); blend(OX + x, OY + D.h * K, 160, 120, 90, 0.5); }
for (let y = 0; y < D.h * K; y++) { blend(OX, OY + y, 160, 120, 90, 0.5); blend(OX + D.w * K, OY + y, 160, 120, 90, 0.5); }
const cols = [[200, 40, 40], [40, 90, 200], [30, 140, 60]];
(spec || '').split(';').filter(Boolean).forEach((s, n) => {
  const [px, py, dir] = s.split(','); const cx = OX + (+px + BASE[0]), cy = OY + (+py + BASE[1]);
  const vars = VAR[dir.trim()]; const c = cols[n % cols.length];
  vars.forEach(([num, rx, ry], vi) => {
    const S = decode(path.join(SPR, `recipebook_arrow_${String(num).padStart(2, '0')}_0.png`).replace(/\\/g, '/'));
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const a = S.data[(y * S.w + x) * 4 + 3] / 255; if (a > 0.05) blend(cx - rx + x, cy - ry + y, c[0], c[1], c[2], a * (vi === 0 ? 0.9 : 0.45)); }
  });
  for (let y = -20; y <= 20; y++) for (let x = -20; x <= 20; x++) if (x * x + y * y <= 400) blend(cx + x, cy + y, c[0], c[1], c[2], 0.35);
});
encode(outF, PW, PH, out);
