// Bakes the diffuse texture for a generated body mesh from the bust's own texture.
// Every texel is computed from its surface attributes (angle, distance below rim, height, arc length),
// so patterns keep the bust's scale regardless of the UV layout.
const fs = require('fs');
const PNG = require('./png');
const { loadGltf } = require('./render');
const { cutUV, componentTris } = require('./rim');

const t = process.argv[2];
const AT = JSON.parse(fs.readFileSync(`body${t}/attrs.json`));
const body = loadGltf(`body${t}/body.gltf`);
const bust = loadGltf(`g${t}/out.gltf`);
const src = PNG.decode(`tex/resident_orient_tier${t}_diff_0.png`);
const { W, H, yc } = AT.meta;
const DEG = 180 / Math.PI;

// ---------- helpers
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (p, q, w) => p.map((v, k) => v * (1 - w) + q[k] * w);
const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
function px(img, x, y) { x = clamp(Math.round(x), 0, img.w - 1); y = clamp(Math.round(y), 0, img.h - 1); const o = (y * img.w + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; }
function bil(img, x, y) { // pixel coords, clamped
  x -= 0.5; y -= 0.5; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const a = px(img, x0, y0), b = px(img, x0 + 1, y0), c = px(img, x0, y0 + 1), d = px(img, x0 + 1, y0 + 1);
  return [0, 1, 2].map(k => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy);
}
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, S = q => q * q * (3 - 2 * q);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s), ux = S(fx), uy = S(fy);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}
function fbm(x, y, s, oct = 4) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2; } return v / n; }

// luminance-sorted colour ramp learned from source pixels
function makeRamp(pixels, N = 48) {
  pixels = pixels.slice().sort((p, q) => lum(p) - lum(q));
  const out = [];
  for (let i = 0; i < N; i++) {
    const a = Math.floor(i / N * pixels.length), b = Math.max(a + 1, Math.floor((i + 1) / N * pixels.length));
    const c = [0, 0, 0]; for (let k = a; k < b; k++) for (let q = 0; q < 3; q++) c[q] += pixels[k][q];
    out.push(c.map(v => v / (b - a)));
  }
  return {
    at(u) { u = clamp(u) * (N - 1); const i = Math.floor(u), f = u - i; return mix(out[i], out[Math.min(N - 1, i + 1)], f); },
    rank(c) { const L = lum(c); let lo = 0; while (lo < N - 1 && lum(out[lo + 1]) < L) lo++; if (lo >= N - 1) return 1; const l0 = lum(out[lo]), l1 = lum(out[lo + 1]); return clamp((lo + (L - l0) / Math.max(1e-6, l1 - l0)) / (N - 1)); },
  };
}
function rectPixels(x0, y0, x1, y1, keep) { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = px(src, x, y); if (keep(c, x, y)) o.push(c); } return o; }
// pixels covered by bust triangles whose vertices pass vfilter
function islandPixels(vfilter, keep = () => true) {
  const mask = new Uint8Array(src.w * src.h);
  for (let i = 0; i < bust.idx.length; i += 3) {
    const ids = [bust.idx[i], bust.idx[i + 1], bust.idx[i + 2]];
    if (!ids.every(vfilter)) continue;
    const U = ids.map(k => [bust.uv[k][0] * src.w, bust.uv[k][1] * src.h]);
    const x0 = Math.floor(Math.min(...U.map(p => p[0]))), x1 = Math.ceil(Math.max(...U.map(p => p[0])));
    const y0 = Math.floor(Math.min(...U.map(p => p[1]))), y1 = Math.ceil(Math.max(...U.map(p => p[1])));
    const ar = (U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[1][1] - U[0][1]) * (U[2][0] - U[0][0]);
    if (Math.abs(ar) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = ((U[1][0] - qx) * (U[2][1] - qy) - (U[1][1] - qy) * (U[2][0] - qx)) / ar;
      const w1 = ((U[2][0] - qx) * (U[0][1] - qy) - (U[2][1] - qy) * (U[0][0] - qx)) / ar;
      if (w0 < 0.02 || w1 < 0.02 || 1 - w0 - w1 < 0.02) continue; // stay off island edges
      if (x >= 0 && y >= 0 && x < src.w && y < src.h) mask[y * src.w + x] = 1;
    }
  }
  const o = []; for (let i = 0; i < mask.length; i++) if (mask[i]) { const c = [src.data[i * 4], src.data[i * 4 + 1], src.data[i * 4 + 2]]; if (keep(c)) o.push(c); }
  return o;
}
// high-pass luminance detail of a source rect; sample(x, y) in source px with mirrored tiling
function detailMap(x0, y0, w, h, rad = 4) {
  const L = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L[y * w + x] = lum(px(src, x0 + x, y0 + y));
  const D = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const xx = clamp(x + dx, 0, w - 1), yy = clamp(y + dy, 0, h - 1); s += L[yy * w + xx]; n++; }
    D[y * w + x] = L[y * w + x] - s / n;
  }
  const wrap = (v, n) => ((Math.floor(v) % n) + n) % n, C = 20, seed = x0 * 7 + y0;
  const at = (x, y, cx, cy) => D[wrap(y + hash(cx, cy, seed + 1) * h, h) * w + wrap(x + hash(cx, cy, seed) * w, w)];
  return (x, y) => { // cells with random source offsets, cross-faded
    const cx = Math.floor(x / C), cy = Math.floor(y / C), fx = smooth(0, 1, x / C - cx), fy = smooth(0, 1, y / C - cy);
    const v = at(x, y, cx, cy) * (1 - fx) * (1 - fy) + at(x, y, cx + 1, cy) * fx * (1 - fy) + at(x, y, cx, cy + 1) * (1 - fx) * fy + at(x, y, cx + 1, cy + 1) * fx * fy;
    return v / Math.sqrt((1 - fx) ** 2 * (1 - fy) ** 2 + fx ** 2 * (1 - fy) ** 2 + (1 - fx) ** 2 * fy ** 2 + fx ** 2 * fy ** 2);
  };
}

// ---------- per-column rim colours (sampled just inside the bust's garment edge)
const cols = AT.cols;
const rimCol = cols.map(c => {
  if (!c.valid || !c.rimUV) return null;
  const r = [c.rimUV[0] * src.w, c.rimUV[1] * src.h];
  let d = c.upUV ? [c.upUV[0] * src.w - r[0], c.upUV[1] * src.h - r[1]] : [0, 0];
  const l = Math.hypot(...d); d = l > 1e-6 ? d.map(v => v / l) : [0, 0];
  const acc = [0, 0, 0]; let n = 0;
  for (const s of [1.5, 2.5, 3.5]) { if (s > l) break; const q = bil(src, r[0] + d[0] * s, r[1] + d[1] * s); for (let k = 0; k < 3; k++) acc[k] += q[k]; n++; }
  if (!n) return bil(src, r[0], r[1]);
  return acc.map(v => v / n);
});
const CLOSED = AT.meta.closed !== false;
const nbr = (j, d, n) => CLOSED ? ((j + d) % (n - 1) + (n - 1)) % (n - 1) : clamp(j + d, 0, n - 1);
// smooth along the rim a little (3 columns) to take out BC7 block noise
const rimSm = rimCol.map((c, j) => {
  if (!c) return null; const acc = [0, 0, 0]; let n = 0;
  for (let d = -1; d <= 1; d++) { const q = rimCol[nbr(j, d, cols.length)]; if (!q) continue; const w = d === 0 ? 2 : 1; for (let k = 0; k < 3; k++) acc[k] += q[k] * w; n += w; }
  return acc.map(v => v / n);
});

// ---------- per-row arc tables: arc length along a ring at a given angle
const NCOL = cols.length, ROWS = (AT.attr.length - AT.attr.filter(q => q.cap).length) / NCOL;
AT.attr.forEach((q, i) => { if (!q.cap) q.k = i % ROWS; });
const arcTab = []; for (let k = 0; k < ROWS; k++) arcTab.push(cols.map((_, j) => AT.attr[j * ROWS + k]));
function arcAt(kf, th) {
  const at = k => { const row = arcTab[clamp(k, 0, ROWS - 1)]; let j = 0; while (j < row.length - 2 && row[j + 1].th < th) j++;
    const f = clamp((th - row[j].th) / (row[j + 1].th - row[j].th)); return row[j].a * (1 - f) + row[j + 1].a * f; };
  const k0 = Math.floor(kf), f = kf - k0; return at(k0) * (1 - f) + at(k0 + 1) * f;
}
// ---------- styles
// hanging cloth folds: a few sine layers across the arc, leaning and fading slowly down the body
function folds(a, z, seed, lam) {
  const L = [lam, lam * 0.57, lam * 0.31], W = [1, 0.5, 0.22];
  const aw = a + 7 * (fbm(a / 40, z / 110, seed + 5, 2) - 0.5) + 2.5 * Math.sin(z / 53 + seed);
  let v = 0, n = 0;
  for (let k = 0; k < 3; k++) {
    const ph = hash(k, seed, 3) + 0.22 * Math.sin(z / (41 + 17 * k) + k * 1.7 + aw / (90 + 30 * k));
    const amp = W[k] * (0.45 + 0.55 * fbm(aw / (L[k] * 2.2), z / 70, seed + 31 * k, 2));
    v += amp * Math.sin(2 * Math.PI * (aw / L[k] + ph)); n += W[k];
  }
  return 0.5 + 0.5 * v / n;
}
// gathered cloth: broad light ridges with narrow dark creases, wavy, bunched in patches with calmer cloth between
function hfolds(a, z, seed) {
  const zw = z + 2.2 * Math.sin(a / 11 + seed) + 5 * (fbm(a / 26, z / 55, seed + 3, 2) - 0.5);
  const bunch = smooth(0.3, 0.72, fbm(a / 16, z / 22, seed + 7, 2));
  let ridge = 0, crease = 0, n = 0;
  for (const [L, w, k] of [[8.5, 1, 0], [5.1, 0.45, 1]]) {
    const ph = hash(k, seed, 9) + 0.15 * fbm(a / (10 + 6 * k), z / 25, seed + 11 * k, 2);
    const v = 0.5 + 0.5 * Math.sin(2 * Math.PI * (zw / L + ph));
    ridge += w * v; crease += w * Math.pow(1 - v, 4); n += w;
  }
  return 0.5 + (0.22 * (ridge / n - 0.5) - 0.34 * crease / n) * (0.3 + 0.7 * bunch);
}
// value per column, linearly interpolated at a fractional column index
const colLerp = (arr, jf) => { const j0 = clamp(Math.floor(jf), 0, arr.length - 1), j1 = Math.min(arr.length - 1, j0 + 1), f = clamp(jf - j0); return arr[j0] * (1 - f) + arr[j1] * f; };
const CREASE = 0.45; // darkening in the dip between arm and torso (shaped bodies only)
const KAFTAN_LIFT = 0.26; // lifts the kaftan to the brightness of the shirt on the bust

let style, styleName;
if (t === '01') {
  styleName = 'nomad';
  const robeRamp = makeRamp(islandPixels(v => bust.joints[v][0] === 24 && bust.uv[v][0] <= 0.2005, c => lum(c) > 18));
  const sashRamp = makeRamp(rectPixels(100, 250, 470, 470, c => lum(c) > 70 && Math.max(...c) - Math.min(...c) < 110));
  const robeGrain = detailMap(6, 130, 34, 360, 2);
  const sashGrain = detailMap(150, 300, 180, 140, 2);
  const RHO = 1.7; // bust texels per unit on the robe
  const band = AT.meta.band;
  const robeGrainF = detailMap(6, 130, 34, 360, 1);
  // fold profile of the bust's robe 3-6 units above the rim, sampled every 0.4 units of arc along the edge
  // (finer than the bust's own texels); the body carries these folds down
  const compCache = new Map();
  const trisFor = t0 => { let tr = [...compCache.values()].find(ts => ts.includes(t0)); if (!tr) { tr = componentTris(bust, t0); compCache.set(t0, tr); } return tr; };
  const colA = cols.map((_, j) => AT.attr[j * ROWS + 1].a); // arc of each column on the rim row
  const PSTEP = 0.4, pA0 = colA[0], pN = Math.ceil((colA[colA.length - 1] - pA0) / PSTEP) + 1;
  let profD = [];
  for (let i = 0; i < pN; i++) {
    const pa = pA0 + i * PSTEP;
    let j = 0; while (j < cols.length - 2 && colA[j + 1] < pa) j++;
    const f = clamp((pa - colA[j]) / (colA[j + 1] - colA[j])), C0 = cols[j], C1 = cols[j + 1];
    const th = C0.th + (C1.th - C0.th) * f, z0 = C0.z0 + (C1.z0 - C0.z0) * f, t0 = f < 0.5 ? C0.rimTri : C1.rimTri;
    let v = null;
    if (t0 !== null && t0 !== undefined) {
      const tris = trisFor(t0), acc = [0, 0, 0]; let n = 0;
      for (const h of [3, 4.5, 6]) {
        const hit = cutUV(bust, yc, th, z0 - h, tris); if (!hit) continue;
        const q = bil(src, hit.uv[0] * src.w, hit.uv[1] * src.h); for (let k = 0; k < 3; k++) acc[k] += q[k]; n++;
      }
      if (n) v = robeRamp.rank(acc.map(x => x / n));
    }
    profD.push(v);
  }
  const known = profD.filter(v => v !== null), mean = known.reduce((p, v) => p + v, 0) / known.length;
  profD = profD.map(v => v === null ? mean : v);
  const profAt = pa => { const x = clamp((pa - pA0) / PSTEP, 0, pN - 1), i = Math.min(pN - 2, Math.floor(x)), f = x - i; return profD[i] * (1 - f) + profD[i + 1] * f; };
  style = (q) => {
    const { a, s, z } = q, deg = q.th * DEG, torso = 1 - smooth(0.3, 0.7, q.arm || 0);
    // the rim's folds, continued down their columns with a slow sway and changing depth
    const aw = a + 1.6 * Math.sin(z / 37 + a / 17.5) * smooth(0, 40, s);
    const depth = 1.35 + 0.45 * (fbm(a / 22, z / 45, 61, 2) - 0.5) + 0.2 * smooth(0, 100, s);
    let f = mean + (profAt(aw) - mean) * depth;
    f += 0.05 * (fbm(a / 1.8, z / 14, 77, 2) - 0.5);              // short painterly streaks
    // some new folds start further down, as cloth does
    const fp = 0.2 + 0.56 * smooth(0.12, 0.9, 0.55 * folds(a, z, 11, 27) + 0.45 * fbm(a / 34, z / 75, 4, 3));
    f += (fp - 0.48) * 0.55 * smooth(15, 110, s);
    const g0 = smooth(band.z0 - 45, band.z0, z) * (1 - smooth(band.z1, band.z1 + 10, z)) * torso;
    f += 0.07 * g0 * (folds(a, z, 41, 6) - 0.5);                 // small creases where it is gathered
    f -= 0.06 * smooth(band.z1 + 2, AT.meta.zhip, z);             // a little darker towards the hips
    f -= 0.14 * torso * smooth(band.z0 - 4, band.z0, z) * (z < band.z0 ? 1 : 0);          // pocket above the sash
    f -= 0.20 * torso * (1 - smooth(band.z1, band.z1 + 4.5, z)) * (z > band.z1 ? 1 : 0);  // shadow below it
    let c = robeRamp.at(clamp(f, 0.02, 0.98));
    const gr = robeGrain(40 - s * RHO, a * RHO) * 1.2 + robeGrainF(40 - s * RHO * 1.3, a * RHO * 1.3 + 90) * 0.7;
    c = c.map(v => v + gr);
    // sash wrapped around the waist (keffiyeh cloth), passing behind the arms
    if (z > band.z0 && z < band.z1 && (q.arm || 0) < 0.8) {
      const u = (z - band.z0) / (band.z1 - band.z0);
      let h = 0.5 + 0.17 * Math.sin(2 * Math.PI * (u * 1.7 + a / 38 + 0.35 * fbm(a / 22, 1, 5, 2)));
      h += 0.1 * Math.sin(2 * Math.PI * (u * 3.1 - a / 61 + 0.5 * fbm(a / 15, 2, 6, 2)));
      h += 0.12 * (fbm(a / 9, u * 3, 31, 3) - 0.5);
      h -= 0.32 * (1 - smooth(0, 0.18, u)) + 0.32 * smooth(0.8, 1, u);   // edges roll under
      h -= 0.10 * smooth(60, 115, Math.abs(deg));
      h -= 0.45 * smooth(0.25, 0.8, q.arm || 0);                         // going in behind the arm
      c = sashRamp.at(0.05 + 0.7 * h).map(v => v + sashGrain(a * 1.9, u * 34) * 0.6);
    }
    return c.map(v => v * (1 - CREASE * (q.ao || 0)));
  };
  style.offDecay = 4;
} else {
  styleName = 'envoy';
  const capeRamp = makeRamp(rectPixels(0, 290, 300, 476, c => c[0] > 45 && c[0] > c[1] + 30 && c[0] > c[2] + 50));
  const whiteRamp = makeRamp(rectPixels(290, 135, 500, 470, c => lum(c) > 55 && Math.max(...c) - Math.min(...c) < 75));
  const capeGrain = detailMap(16, 356, 64, 60, 2);
  const whiteGrain = detailMap(374, 205, 60, 120, 2);
  const bandY0 = 479, bandY1 = 509;              // ornamental frieze at the bottom of the texture
  const lattY0 = 483, lattY1 = 507;
  const band = AT.meta.band;
  // braids leave the rim where the bust's braids end and settle on their line within ~12 units:
  // the inner pair keeps the bust's outward lean, the outer pair runs down the front of the sleeves
  const BRAIDS = [[29, 36], [76, 72], [-36, -36], [-72, -72]], BRAID_W = 7.5;
  // the frieze is darker than the braids on the bust: map its colours onto the bust braids' mean and spread
  const cstat = px3 => { const m = [0, 1, 2].map(k => px3.reduce((s, c) => s + c[k], 0) / px3.length);
    return { m, sd: [0, 1, 2].map(k => Math.sqrt(px3.reduce((s, c) => s + (c[k] - m[k]) ** 2, 0) / px3.length)) }; };
  const bustBraid = [];
  for (const [b0] of BRAIDS.filter(b => b[0] > 0)) for (let d = b0 - 6; d <= b0 + 6; d += 0.5) {
    const th = d / DEG; let cn = cols[0]; for (const c2 of cols) if (Math.abs(c2.th - th) < Math.abs(cn.th - th)) cn = c2;
    if (cn.rimTri === null || cn.rimTri === undefined) continue;
    const tris = componentTris(bust, cn.rimTri);
    for (const h of [1.5, 3, 4.5, 6, 8]) { const hit = cutUV(bust, yc, th, cn.z0 - h, tris); if (hit) bustBraid.push(bil(src, hit.uv[0] * src.w, hit.uv[1] * src.h)); }
  }
  const BB = cstat(bustBraid), FR = cstat(rectPixels(0, lattY0, 512, lattY1, () => true));
  const braidTone = c => c.map((v, k) => (v - FR.m[k]) * (BB.sd[k] / FR.sd[k]) * 1.3 + BB.m[k]); // a little crisper lattice
  const CAPE_BACK = 117;                         // the long back cape starts here on the + side
  const hem = deg => {                           // how far the drape reaches below the rim on the - side
    if (deg >= 5) return -1;
    const d = 5 - deg;
    return 2 + 26 * smooth(0, 60, d) + 120 * smooth(70, 125, d) + 2.5 * Math.sin(d / 7);
  };
  style = (q) => {
    const { a, s, z, r } = q, deg = q.th * DEG, torso = 1 - smooth(0.3, 0.7, q.arm || 0);
    const rr = Math.max(20, r);
    let capeDist; // >0 inside the cape (surface units from its edge), <0 outside
    if (deg >= 5) capeDist = (deg - CAPE_BACK) / DEG * rr;
    else {
      const hs = hem(deg), slope = (hem(deg - 1) - hem(deg + 1)) / 2 / (rr / DEG);
      capeDist = (hs - s) / Math.sqrt(1 + slope * slope);
      if (deg > -2) capeDist = Math.min(capeDist, (5 - deg) / DEG * rr);
    }
    let c;
    if (capeDist > 0) {
      let f = 0.7 * folds(a, z, 7, 21) + 0.3 * fbm(a / 30, z / 70, 8, 3);
      f = 0.22 + 0.62 * smooth(0.15, 0.85, f);
      f -= 0.12 * smooth(70, 130, Math.abs(deg));
      if (capeDist < 1.1) f = 0.08 + 0.1 * capeDist;                       // turned hem: dark outline
      else if (capeDist < 3.6) f = Math.max(f, 0.6 + 0.08 * Math.sin(capeDist * 1.4)); // lighter border
      c = capeRamp.at(f);
      c = c.map(v => v + capeGrain(a * 1.4, z * 1.4) * 0.8);
    } else {
      // kaftan in gathered horizontal folds, like the shirt on the bust
      let f = KAFTAN_LIFT + hfolds(a, z, 3) + 0.18 * (fbm(a / 25, z / 30, 9, 3) - 0.5);
      f -= 0.12 * smooth(55, 115, Math.abs(deg));
      f -= 0.25 * (1 - smooth(-3.5, 0, capeDist));               // cast shadow under the cape edge
      c = whiteRamp.at(f);
      c = c.map(v => v + whiteGrain(a * 1.35, z * 1.35) * 0.15);
      // braids: the frieze lattice turned vertical
      for (const [b0, b1] of BRAIDS) {
        const bd = b1 + (b0 - b1) * Math.exp(-Math.max(0, s) / 12);
        const da = a - arcAt(q.k, bd / DEG);
        if (Math.abs(da) < BRAID_W / 2 + 0.9) {
          if (Math.abs(da) > BRAID_W / 2) { c = c.map(v => v * 0.75); continue; }
          const across = (da / BRAID_W + 0.5) * (lattY1 - lattY0) + lattY0;
          const along = z * (lattY1 - lattY0) / BRAID_W;
          c = braidTone(bil(src, ((along % 512) + 512) % 512, across));
        }
      }
      // belt: the whole frieze, under the cape and behind the arms
      if (z > band.z0 && z < band.z1 && (q.arm || 0) < 0.8) {
        const u = (z - band.z0) / (band.z1 - band.z0);
        const along = a * (bandY1 - bandY0) / (band.z1 - band.z0);
        c = bil(src, ((along % 512) + 512) % 512, bandY0 + u * (bandY1 - bandY0));
        c = c.map(v => v * (1 - 0.12 * smooth(55, 115, Math.abs(deg))) * (1 - 0.55 * smooth(0.25, 0.8, q.arm || 0)));
      } else if (z > band.z1 && z < band.z1 + 3 && torso > 0.5) c = c.map(v => v * (0.7 + 0.3 * smooth(band.z1, band.z1 + 3, z)));
    }
    return c.map(v => v * (1 - CREASE * (q.ao || 0)));
  };
}

// ---------- rasterize the body in UV space
const NV = body.pos.length, attr = AT.attr;
const img = PNG.create(W, H, [0, 0, 0, 0]);
const filled = new Uint8Array(W * H);
// first pass: generated colour at the top of every column, to carry the rim's low frequencies down
const NCc = cols.length;
const genTop = [], offs = [];
const rowsPerCol = (attr.length - (attr.filter(q => q.cap).length)) / NCc;
for (let j = 0; j < NCc; j++) {
  const q = attr[j * rowsPerCol + 1]; // row 0
  const p = body.pos[j * rowsPerCol + 1];
  genTop.push(style({ ...q, r: Math.hypot(p[0], p[1] - yc) }));
}
for (let j = 0; j < NCc; j++) offs.push(rimSm[j] ? rimSm[j].map((v, k) => v - genTop[j][k]) : [0, 0, 0]);
// smooth offsets along the rim
const offSm = offs.map((_, j) => { const acc = [0, 0, 0]; let n = 0; for (let d = -2; d <= 2; d++) { const q = offs[nbr(j, d, NCc)]; for (let k = 0; k < 3; k++) acc[k] += q[k]; n++; } return acc.map(v => v / n); });

function shade(q, p) {
  if (q.cap) return [40, 30, 22];
  const r = Math.hypot(p[0], p[1] - yc);
  const jf = clamp(q.j, 0, NCc - 1), j0 = Math.floor(jf), j1 = Math.min(NCc - 1, j0 + 1), fj = jf - j0;
  const valid0 = rimSm[j0], valid1 = rimSm[j1];
  let c = style({ ...q, r });
  // carry the rim colour down with a short decay
  const off = mix(offSm[j0], offSm[j1], fj);
  const dec = Math.exp(-Math.max(0, q.s) / (style.offDecay || 9));
  c = c.map((v, k) => v + off[k] * dec);
  // at and above the rim use the bust colour itself
  if (valid0 && valid1) {
    const rc = mix(valid0, valid1, fj);
    c = mix(rc, c, smooth(0, 3.5, q.s));
  }
  return c.map(v => clamp(v, 0, 255));
}

const tri = body.idx;
for (let i = 0; i < tri.length; i += 3) {
  const ids = [tri[i], tri[i + 1], tri[i + 2]];
  const U = ids.map(k => [body.uv[k][0] * W, body.uv[k][1] * H]);
  const ar = (U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[1][1] - U[0][1]) * (U[2][0] - U[0][0]);
  if (Math.abs(ar) < 1e-9) continue;
  const x0 = Math.max(0, Math.floor(Math.min(...U.map(p => p[0])) - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(...U.map(p => p[0])) + 1));
  const y0 = Math.max(0, Math.floor(Math.min(...U.map(p => p[1])) - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(...U.map(p => p[1])) + 1));
  const Q = ids.map(k => attr[k]);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const qx = x + 0.5, qy = y + 0.5;
    const w0 = ((U[1][0] - qx) * (U[2][1] - qy) - (U[1][1] - qy) * (U[2][0] - qx)) / ar;
    const w1 = ((U[2][0] - qx) * (U[0][1] - qy) - (U[2][1] - qy) * (U[0][0] - qx)) / ar;
    const w2 = 1 - w0 - w1;
    if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
    const o = y * W + x; if (filled[o] === 2) continue;
    const W3 = [w0, w1, w2];
    let q;
    if (Q[0].cap) q = { cap: 1 };
    else { q = {}; for (const f of ['th', 's', 'z', 'a', 'j', 'ao', 'arm', 'k']) q[f] = W3[0] * Q[0][f] + W3[1] * Q[1][f] + W3[2] * Q[2][f]; }
    const p = [0, 1, 2].map(k => W3[0] * body.pos[ids[0]][k] + W3[1] * body.pos[ids[1]][k] + W3[2] * body.pos[ids[2]][k]);
    const c = shade(q, p);
    img.data[o * 4] = c[0]; img.data[o * 4 + 1] = c[1]; img.data[o * 4 + 2] = c[2]; img.data[o * 4 + 3] = 255;
    filled[o] = (w0 >= 0 && w1 >= 0 && w2 >= 0) ? 2 : 1;
  }
}
// cap texel block
for (let y = H - 12; y < H; y++) for (let x = W - 12; x < W; x++) { const o = y * W + x; img.data.set([40, 30, 22, 255], o * 4); filled[o] = 2; }
// dilate into empty space so mips do not bleed black
for (let pass = 0; pass < 24; pass++) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = y * W + x; if (filled[o]) continue;
    const acc = [0, 0, 0]; let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const oo = yy * W + xx; if (!filled[oo]) continue; for (let k = 0; k < 3; k++) acc[k] += img.data[oo * 4 + k]; n++; }
    if (n) add.push([o, acc.map(v => v / n)]);
  }
  for (const [o, c] of add) { img.data[o * 4] = c[0]; img.data[o * 4 + 1] = c[1]; img.data[o * 4 + 2] = c[2]; img.data[o * 4 + 3] = 255; filled[o] = 1; }
}
for (let o = 0; o < W * H; o++) if (!filled[o]) { const c = [60, 45, 35]; img.data.set([...c, 255], o * 4); }
PNG.encode(`body${t}/body_diff.png`, img, false);
console.log(styleName, 'baked', W + 'x' + H);
