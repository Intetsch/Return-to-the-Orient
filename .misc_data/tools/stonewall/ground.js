// Grass-free copies of the Orient canal's six ground decals for the wall (the canal keeps its grass).
// The six share one colour image (only alpha differs), so one grass mask (Lab a* < A_MAX in any of them, grown by GROW px,
// plus the small islands it encloses) is filled once on the cross texture by image quilting: B px blocks in raster
// order, each chosen among the K best matches to the pixels already known around it, joined to earlier blocks by
// minimum-error cuts. Sources are opaque sand away from the grass. Every filled pixel copies exactly one sand pixel, so the grain
// stays (averaging fills such as PatchMatch voting came out as a flat blob). Each shape keeps its own alpha.
// node ground.js <outDir>  -> <outDir>/stonewall_ground_<shape>_diff_0.png, mask.png
const fs = require('fs'), path = require('path');
const { decode, encode } = require('../ornament_icons/png.js');
const MOD = path.resolve(__dirname, '../../..');
const SRC = path.join(MOD, 'data/graphics/buildings/orient/canal/maps');
const SHAPES = ['straight', 'end', 'curve', '3way', 'cross', 'single'];
const A_MAX = 2.5, GROW = 2, ISLAND = 600, B = 20, OV = 6, K = 6, SEED = 7;
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });

let seed = SEED;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function labA(r, g, b) {
  const R_ = lin(r), G = lin(g), B_ = lin(b);
  const X = (0.4124 * R_ + 0.3576 * G + 0.1805 * B_) / 0.95047, Y = 0.2126 * R_ + 0.7152 * G + 0.0722 * B_;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return 500 * (f(X) - f(Y));
}

const ims = SHAPES.map(s => decode(path.join(SRC, `canal_system_ground_${s}_01_orient_diff_0.png`)));
const W = ims[0].w, H = ims[0].h, N = W * H;
const base = ims[SHAPES.indexOf('cross')];

// ---- mask ----
const grass = new Uint8Array(N);
for (const im of ims) for (let p = 0; p < N; p++) if (im.px[p * 4 + 3] > 0 && labA(im.px[p * 4], im.px[p * 4 + 1], im.px[p * 4 + 2]) < A_MAX) grass[p] = 1;
const grow = (m, r) => {
  const o = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m[y * W + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) o[yy * W + xx] = 1;
    }
  }
  return o;
};
const hole = grow(grass, GROW);
{ // small islands enclosed by grass (the light pebbles in the patch)
  const seen = new Uint8Array(N);
  for (let p0 = 0; p0 < N; p0++) {
    if (hole[p0] || seen[p0]) continue;
    const comp = [p0], stack = [p0]; seen[p0] = 1; let edge = false;
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const q = yy * W + xx; if (hole[q] || seen[q]) continue; seen[q] = 1; stack.push(q); comp.push(q);
      }
    }
    if (!edge && comp.length < ISLAND) for (const p of comp) hole[p] = 1;
  }
}
const ban = grow(hole, 2);
const allow = new Uint8Array(N); for (let p = 0; p < N; p++) allow[p] = base.px[p * 4 + 3] > 200 && !ban[p] ? 1 : 0;

// ---- quilting ----
// source blocks: top-left corners whose B x B block is all allowed (stride 2)
const cands = [];
for (let y = 0; y + B <= H; y += 2) for (let x = 0; x + B <= W; x += 2) {
  let ok = 1;
  for (let dy = 0; dy < B && ok; dy++) for (let dx = 0; dx < B; dx++) if (!allow[(y + dy) * W + x + dx]) { ok = 0; break; }
  if (ok) cands.push(y * W + x);
}
const cur = Float32Array.from({ length: N * 3 }, (_, i) => base.px[Math.floor(i / 3) * 4 + i % 3]);
const state = new Uint8Array(N); for (let p = 0; p < N; p++) state[p] = hole[p] ? 1 : 0; // 0 known, 1 to fill, 2 filled
const srcOf = new Int32Array(N).fill(-1);
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let p = 0; p < N; p++) if (hole[p]) { const x = p % W, y = (p / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
const STEP = B - OV;
let blocks = 0;
for (let by = Math.max(0, y0 - OV); by <= y1; by += STEP) for (let bx = Math.max(0, x0 - OV); bx <= x1; bx += STEP) {
  const bw = Math.min(B, W - bx), bh = Math.min(B, H - by);
  let need = 0; const cons = [];
  for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) { const s = state[(by + dy) * W + bx + dx]; if (s === 1) need = 1; else cons.push([dx, dy]); }
  if (!need) continue;
  blocks++;
  // the K best sources by SSD over the pixels already known or filled in this block
  const best = [];
  for (const c of cands) {
    let d = 0;
    for (const [dx, dy] of cons) {
      const a = ((by + dy) * W + bx + dx) * 3, b = (c + dy * W + dx) * 4;
      for (let k = 0; k < 3; k++) { const e = cur[a + k] - base.px[b + k]; d += e * e; }
      if (best.length === K && d >= best[K - 1][0]) break;
    }
    if (best.length < K || d < best[K - 1][0]) { best.push([d, c]); best.sort((u, v) => u[0] - v[0]); if (best.length > K) best.pop(); }
  }
  const c = best[(rnd() * best.length) | 0][1];
  // minimum-error cuts through the left and top overlaps (only against filled pixels; known pixels are never replaced)
  const err = (dx, dy) => { const p = (by + dy) * W + bx + dx; if (state[p] !== 2) return 0; const a = p * 3, b = (c + dy * W + dx) * 4; let e = 0; for (let k = 0; k < 3; k++) e += (cur[a + k] - base.px[b + k]) ** 2; return e; };
  const cut = (len, wid, e) => { // DP over len lines of wid cells; returns the cut index per line (cells <= cut keep the old content)
    const C = [], F = [];
    for (let i = 0; i < len; i++) { C.push([]); F.push([]); for (let j = 0; j < wid; j++) { let m = 0, f = j; if (i) { m = Infinity; for (const jj of [j - 1, j, j + 1]) if (jj >= 0 && jj < wid && C[i - 1][jj] < m) { m = C[i - 1][jj]; f = jj; } } C[i].push(m + e(i, j)); F[i].push(f); } }
    const r = new Array(len); let j = 0; for (let jj = 1; jj < wid; jj++) if (C[len - 1][jj] < C[len - 1][j]) j = jj;
    for (let i = len - 1; i >= 0; i--) { r[i] = j; j = F[i][j]; }
    return r;
  };
  const ovx = Math.min(OV, bw), ovy = Math.min(OV, bh);
  const cutL = cut(bh, ovx, (i, j) => err(j, i)), cutT = cut(bw, ovy, (i, j) => err(i, j));
  for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) {
    const p = (by + dy) * W + bx + dx;
    if (state[p] === 0) continue;
    if (state[p] === 2 && ((dx < ovx && dx <= cutL[dy]) || (dy < ovy && dy <= cutT[dx]))) continue;
    const q = c + dy * W + dx;
    for (let k = 0; k < 3; k++) cur[p * 3 + k] = base.px[q * 4 + k];
    srcOf[p] = q; state[p] = 2;
  }
}

// ---- write: each shape's own colours outside the hole, the quilted sand inside, own alpha ----
for (let i = 0; i < SHAPES.length; i++) {
  const im = ims[i], px = Buffer.from(im.px);
  for (let p = 0; p < N; p++) if (srcOf[p] >= 0) for (let k = 0; k < 3; k++) px[p * 4 + k] = base.px[srcOf[p] * 4 + k];
  let left = 0; for (let p = 0; p < N; p++) if (px[p * 4 + 3] > 0 && labA(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]) < A_MAX) left++;
  encode(path.join(out, `stonewall_ground_${SHAPES[i]}_diff_0.png`), W, H, 4, px);
  console.log(`${SHAPES[i].padEnd(9)} green pixels left ${left}`);
}
const mpx = Buffer.alloc(N * 4); for (let p = 0; p < N; p++) { const v = hole[p] ? 255 : allow[p] ? 0 : 90; mpx[p * 4] = mpx[p * 4 + 1] = mpx[p * 4 + 2] = v; mpx[p * 4 + 3] = 255; }
encode(path.join(out, 'mask.png'), W, H, 4, mpx);
console.log('grass', grass.reduce((a, b) => a + b, 0), 'px, filled', hole.reduce((a, b) => a + b, 0), 'of', N, '| blocks', blocks, '| source blocks', cands.length, '| unfilled', state.reduce((a, s) => a + (s === 1), 0));
