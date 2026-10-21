// Small Oriental Wall texture (diff / norm / metal, 128x64): two bands that tile every world unit along the wall.
//   rows  2..37  face band: the Incense Workshop L wall's outer face, made periodic with a min-error seam
//   rows 42..51  cap band:  the L wall's cap stones, cut joint-to-joint from both arms and resampled to one period
//   other rows   edge padding (keeps bilinear/mips from mixing the bands)
// node build_tex.js <outDir>   -> <outDir>/stonewall_{diff,norm,metal}.png + layout.json
const fs = require('fs'), path = require('path');
const { outer, topX, topZ, sampleUV, H } = require('./src.js');
const { encode } = require('../ornament_icons/png.js');
const out = process.argv[2];
const PPU = 128, W = 128, TH = 64;
const FACE = { row0: 2, rows: 36 }, CAP = { row0: 42, rows: 10 };

// strip[map][row][col] = rgba, sampled through the source mesh's UVs
function strip(f, c0, c1, rows, tOf) {
  const m = [[], [], []];
  for (let r = 0; r < rows; r++) {
    for (const a of m) a.push([]);
    for (let c = c0; c < c1; c++) {
      const s = sampleUV(f((c + 0.5) / PPU, tOf((r + 0.5) / rows)));
      for (let k = 0; k < 3; k++) m[k][r].push(s[k]);
    }
  }
  return m;
}

// ---- face band: S columns c0..c0+P+w, periodic with a vertical min-error seam in the first w columns ----
// usable full-height range of the outer path: s 0.071..1.323 (chamfered ends) -> columns 12..167
const C0 = 12, WO = 28;
const S = strip(outer, C0, C0 + W + WO, FACE.rows, t => t * H);
const err = (r, x) => { const a = S[0][r][W + x], b = S[0][r][x]; return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; };
const KMIN = 2, KMAX = WO - 2, cost = [], from = [];
for (let r = 0; r < FACE.rows; r++) {
  cost.push([]); from.push([]);
  for (let k = 0; k < WO; k++) {
    if (k < KMIN || k > KMAX) { cost[r].push(Infinity); from[r].push(-1); continue; }
    let best = 0, bk = k;
    if (r) { best = Infinity; for (const d of [-1, 0, 1]) { const kk = k + d; if (kk >= 0 && kk < WO && cost[r - 1][kk] < best) { best = cost[r - 1][kk]; bk = kk; } } }
    cost[r].push(best + err(r, k)); from[r].push(bk);
  }
}
const seam = new Array(FACE.rows);
{ let k = 0; for (let j = 1; j < WO; j++) if (cost[FACE.rows - 1][j] < cost[FACE.rows - 1][k]) k = j;
  for (let r = FACE.rows - 1; r >= 0; r--) { seam[r] = k; k = from[r][k]; } }
// T[x] = A (continuation past the period end, S[W+x]) left of the seam, B (S[x]) right of it, 2 px feather
const face = [0, 1, 2].map(m => S[m].map((row, r) => row.slice(0, W).map((b, x) => {
  if (x >= WO) return b;
  const a = row[W + x], wA = Math.min(1, Math.max(0, seam[r] - x + 0.5));
  return b.map((v, k) => a[k] * wA + v * (1 - wA));
})));

// ---- cap band: joint-to-joint runs (each starts on a joint column), concatenated and resampled to W ----
// joints from the column brightness of the rectified strips: topX 7,16,(29),37,50  topZ 21,30,41,57,64
// topZ runs the other way round (handedness): rows reversed, normal x and y negated
const capX = strip(topX, 0, 62, CAP.rows, t => t);
const capZ = strip(topZ, 0, 86, CAP.rows, t => 1 - t).map((rows, m) => rows.map(row => row.map(p => m === 1 ? [255 - p[0], 255 - p[1], p[2], p[3]] : p)));
const RUNS = [[capX, 7, 37], [capZ, 21, 57], [capZ, 57, 85], [capX, 16, 37]];
const seq = [0, 1, 2].map(m => [...Array(CAP.rows)].map((_, r) => RUNS.flatMap(([src, a, b]) => src[m][r].slice(a, b))));
const N = seq[0][0].length;
const cap = seq.map(rows => rows.map(row => [...Array(W)].map((_, x) => {
  const f = (x + 0.5) * N / W - 0.5, i = Math.floor(f), t = f - i, p = row[(i + N) % N], q = row[(i + 1) % N];
  return p.map((v, k) => v * (1 - t) + q[k] * t);
})));

// ---- large wall: the face 3x as tall (108 rows over 3H). Shifted copies of the band are stacked: the bottom copy keeps
// the ground rows, the top copy the light top edge, the middle ones only inner courses. Each copy joins the one below
// along a minimum-error cut that wraps around in x (the band is periodic).
const STACK = [[0, 30, 0], [4, 32, 43], [4, 32, 85], [4, 32, 21], [6, 36, 64]]; // [band row from, to, x shift]
const OVL = 9;
const srcRow = [], srcCol = [];
let top = 0;
STACK.forEach(([r0, r1, sh], i) => {
  const len = r1 - r0, t0 = i ? top - OVL : 0;
  const bandAt = (t, x) => [r0 + t - t0, (x + sh) % W];
  // cut row k(x) in the overlap: below it the lower copy stays
  let cutK = new Array(W).fill(0);
  if (i) {
    const e = (x, k) => { const [r, c] = bandAt(t0 + k, x), a = face[0][srcRow[t0 + k][x]][srcCol[t0 + k][x]], b = face[0][r][c]; return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; };
    let best = Infinity;
    for (let k0 = 0; k0 < OVL; k0++) {
      const C = [new Array(OVL).fill(Infinity)], F = [new Array(OVL).fill(-1)];
      C[0][k0] = e(0, k0);
      for (let x = 1; x < W; x++) {
        C.push(new Array(OVL).fill(Infinity)); F.push(new Array(OVL).fill(-1));
        for (let k = 0; k < OVL; k++) for (const kk of [k - 1, k, k + 1]) if (kk >= 0 && kk < OVL && C[x - 1][kk] + e(x, k) < C[x][k]) { C[x][k] = C[x - 1][kk] + e(x, k); F[x][k] = kk; }
      }
      for (let k = Math.max(0, k0 - 1); k <= Math.min(OVL - 1, k0 + 1); k++) if (C[W - 1][k] < best) {
        best = C[W - 1][k]; let kk = k; for (let x = W - 1; x >= 0; x--) { cutK[x] = kk; kk = F[x][kk]; }
      }
    }
  }
  for (let t = t0; t < t0 + len; t++) {
    if (!srcRow[t]) { srcRow[t] = []; srcCol[t] = []; }
    for (let x = 0; x < W; x++) {
      if (i && t - t0 < OVL && t - t0 < cutK[x]) continue;
      [srcRow[t][x], srcCol[t][x]] = bandAt(t, x);
    }
  }
  top = t0 + len;
});
const faceL = [0, 1, 2].map(m => srcRow.map((row, t) => row.map((r, x) => face[m][r][srcCol[t][x]])));

// ---- atlases: face band from row 2, cap band 4 rows below it, edge padding ----
const NAMES = ['diff', 'norm', 'metal'];
fs.mkdirSync(out, { recursive: true });
function atlas(prefix, faceM, TH_, wallH, layoutName) {
  const fr = faceM[0].length, f0 = 2, c0 = f0 + fr + 4;
  for (let m = 0; m < 3; m++) {
    const rowAt = y => {
      if (y < f0) return faceM[m][0];
      if (y < f0 + fr) return faceM[m][y - f0];
      if (y < (f0 + fr + c0) / 2) return faceM[m][fr - 1];
      if (y < c0) return cap[m][0];
      if (y < c0 + CAP.rows) return cap[m][y - c0];
      return cap[m][CAP.rows - 1];
    };
    const px = Buffer.alloc(W * TH_ * 4);
    for (let y = 0; y < TH_; y++) { const row = rowAt(y); for (let x = 0; x < W; x++) for (let k = 0; k < 4; k++) px[(y * W + x) * 4 + k] = Math.round(Math.max(0, Math.min(255, row[x][k]))); }
    encode(path.join(out, `${prefix}_${NAMES[m]}.png`), W, TH_, 4, px);
  }
  const layout = { W, TH: TH_, face: { v0: f0 / TH_, v1: (f0 + fr) / TH_ }, cap: { v0: c0 / TH_, v1: (c0 + CAP.rows) / TH_ }, H: wallH };
  fs.writeFileSync(path.join(out, layoutName), JSON.stringify(layout, null, 1));
}
atlas('stonewall', face, TH, H, 'layout.json');            // 128x64
atlas('stonewall_large', faceL, 128, 3 * H, 'layout_large.json'); // 128x128
console.log('seam columns', seam.join(','), '| cap source columns', N, '->', W, '| seam cost', cost[FACE.rows - 1][seam[FACE.rows - 1]].toFixed(0), '| large face rows', faceL[0].length);
