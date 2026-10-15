// Diffuse texture for a generated 1404 lower body (body1404.js), generic version of portrait_body/bake.js:
// the garment just above the bust's rim, sampled every 0.4 units of arc, is carried straight down. Its colour comes
// from a smoothed profile and its folds from the profile's own light/dark variation, which sways a little and
// slowly fades, while new folds grow in further down; fine grain and slight darkening towards the hips.
// At the seam the texture blends into the bust's own rim colour.
// bake(id) -> work/<id>/body/body_diff.png (1024x512)
const fs = require('fs'), path = require('path');
const MOD = process.env.ORIENT_MOD || path.resolve(__dirname, '../../..');
const T = path.join(MOD, '.misc_data/tools/portrait_body');
const PNG = require(path.join(T, 'png.js'));
const { loadGltf } = require(path.join(T, 'render.js'));
const { cutUV, componentTris } = require(path.join(T, 'rim.js'));
const WORK = path.join(__dirname, 'work');

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (p, q, w) => p.map((v, k) => v * (1 - w) + q[k] * w);
const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
function px(img, x, y) { x = clamp(Math.round(x), 0, img.w - 1); y = clamp(Math.round(y), 0, img.h - 1); const o = (y * img.w + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]]; }
function bil(img, x, y) {
  x -= 0.5; y -= 0.5; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const a = px(img, x0, y0), b = px(img, x0 + 1, y0), c = px(img, x0, y0 + 1), d = px(img, x0 + 1, y0 + 1);
  return [0, 1, 2, 3].map(k => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy);
}
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, S = q => q * q * (3 - 2 * q);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s), ux = S(fx), uy = S(fy);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}
function fbm(x, y, s, oct = 4) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2; } return v / n; }
function folds(a, z, seed, lam) { // hanging cloth: sine layers across the arc, leaning and fading slowly (bake.js)
  const L = [lam, lam * 0.57, lam * 0.31], Wt = [1, 0.5, 0.22];
  const aw = a + 7 * (fbm(a / 40, z / 110, seed + 5, 2) - 0.5) + 2.5 * Math.sin(z / 53 + seed);
  let v = 0, n = 0;
  for (let k = 0; k < 3; k++) {
    const ph = hash(k, seed, 3) + 0.22 * Math.sin(z / (41 + 17 * k) + k * 1.7 + aw / (90 + 30 * k));
    const amp = Wt[k] * (0.45 + 0.55 * fbm(aw / (L[k] * 2.2), z / 70, seed + 31 * k, 2));
    v += amp * Math.sin(2 * Math.PI * (aw / L[k] + ph)); n += Wt[k];
  }
  return 0.5 + 0.5 * v / n;
}

function bake(id) {
  const dir = path.join(WORK, id, 'body');
  const AT = JSON.parse(fs.readFileSync(path.join(dir, 'attrs.json')));
  const body = loadGltf(path.join(dir, 'body.gltf'));
  const raw = loadGltf(path.join(WORK, id, 'icon', 'out.gltf'));
  const src = PNG.decode(path.join(WORK, id, 'tex', id + '_diff.png'));
  const { W, H, frame } = AT.meta, seed = [...id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) % 997;
  // the bust in the frame the body was built in
  const c0 = Math.cos(-frame.phi), s0 = Math.sin(-frame.phi);
  const bust = { pos: raw.pos.map(p => { const x = p[0] - frame.xc, y = p[1] - frame.yc; return [c0 * x - s0 * y, s0 * x + c0 * y, p[2]]; }), uv: raw.uv, idx: raw.idx };
  const cols = AT.cols, NC = cols.length, ROWS = (AT.attr.length - AT.attr.filter(q => q.cap).length) / NC;
  const colA = cols.map((_, j) => AT.attr[j * ROWS + 1].a);
  const texAt = uv => bil(src, uv[0] * src.w, uv[1] * src.h);
  // ---- rim colour per column: just inside the garment edge (as bake.js), opaque texels only
  const rimCol = cols.map(c => {
    if (!c.rimUV) return null;
    const r = [c.rimUV[0] * src.w, c.rimUV[1] * src.h];
    let d = c.upUV ? [c.upUV[0] * src.w - r[0], c.upUV[1] * src.h - r[1]] : [0, 0];
    const l = Math.hypot(...d); d = l > 1e-6 ? d.map(v => v / l) : [0, 0];
    const acc = [0, 0, 0]; let n = 0;
    for (const s of [1.5, 2.5, 3.5]) { if (s > l) break; const q = bil(src, r[0] + d[0] * s, r[1] + d[1] * s); if (q[3] < 128) continue; for (let k = 0; k < 3; k++) acc[k] += q[k]; n++; }
    if (!n) { const q = bil(src, r[0], r[1]); return q[3] < 128 ? null : q.slice(0, 3); }
    return acc.map(v => v / n);
  });
  // ---- garment profile above the rim, every 0.4 units of arc
  const compCache = [];
  const trisFor = t0 => { let tr = compCache.find(ts => ts.has(t0)); if (!tr) { tr = new Set(componentTris(bust, t0)); compCache.push(tr); } return [...tr]; };
  const PSTEP = 0.4, pA0 = colA[0], pN = Math.ceil((colA[NC - 1] - pA0) / PSTEP) + 1;
  const prof = [];
  for (let i = 0; i < pN; i++) {
    const pa = pA0 + i * PSTEP;
    let j = 0; while (j < NC - 2 && colA[j + 1] < pa) j++;
    const f = clamp((pa - colA[j]) / ((colA[j + 1] - colA[j]) || 1)), C0 = cols[j], C1 = cols[j + 1];
    const th = C0.th + (C1.th - C0.th) * f, z0 = C0.z0 + (C1.z0 - C0.z0) * f, t0 = f < 0.5 ? C0.rimTri : C1.rimTri;
    let v = null;
    if (t0 !== null && t0 !== undefined) {
      const tris = trisFor(t0), acc = [0, 0, 0]; let n = 0;
      for (const h of [2, 3.5, 5, 6.5, 8]) {
        const hit = cutUV(bust, 0, th, z0 - h, tris); if (!hit) continue;
        const q = texAt(hit.uv); if (q[3] < 128) continue;
        for (let k = 0; k < 3; k++) acc[k] += q[k]; n++;
      }
      if (n) v = acc.map(x => x / n);
    }
    prof.push(v);
  }
  // fill gaps from the rim colours / neighbours
  for (let i = 0; i < pN; i++) if (!prof[i]) {
    let j = 0; const pa = pA0 + i * PSTEP; while (j < NC - 2 && colA[j + 1] < pa) j++;
    prof[i] = rimCol[j] || rimCol[j + 1] || null;
  }
  const known = prof.filter(Boolean), meanC = [0, 1, 2].map(k => known.reduce((s, c) => s + c[k], 0) / Math.max(1, known.length));
  for (let i = 0; i < pN; i++) if (!prof[i]) prof[i] = meanC;
  // smoothed base colour (gaussian, sigma 3 units) and relative fold shading
  const SIG = 3 / PSTEP, base = prof.map((_, i) => {
    const acc = [0, 0, 0]; let n = 0;
    for (let d = -Math.ceil(3 * SIG); d <= Math.ceil(3 * SIG); d++) { const q = prof[clamp(i + d, 0, pN - 1)], w = Math.exp(-d * d / (2 * SIG * SIG)); for (let k = 0; k < 3; k++) acc[k] += q[k] * w; n += w; }
    return acc.map(v => v / n);
  });
  const rel = prof.map((c, i) => clamp(lum(c) / Math.max(8, lum(base[i])), 0.7, 1.35));
  // the garment's dominant colour: a wide smoothing (sigma 10 units) weighted towards the commonest tones, so narrow
  // trims, fur edges and chains at the rim (Lord Northburg) fade out going down instead of running as stripes
  const SIGW = 10 / PSTEP, wide = prof.map((_, i) => {
    const acc = [0, 0, 0]; let n = 0;
    for (let d = -Math.ceil(2.5 * SIGW); d <= Math.ceil(2.5 * SIGW); d += 2) {
      const q = prof[clamp(i + d, 0, pN - 1)], w = Math.exp(-d * d / (2 * SIGW * SIGW)) * (1 / (1 + Math.abs(lum(q) - lum(base[i])) / 30));
      for (let k = 0; k < 3; k++) acc[k] += q[k] * w; n += w;
    }
    return acc.map(v => v / n);
  });
  const at = (arr, pa) => { const x = clamp((pa - pA0) / PSTEP, 0, pN - 1), i = Math.min(pN - 2, Math.floor(x)), f = x - i; return Array.isArray(arr[0]) ? mix(arr[i], arr[i + 1], f) : arr[i] * (1 - f) + arr[i + 1] * f; };
  const smax = AT.meta.smax;
  // belt at the waist, where the Nomad's sash (eyes +191..+209) and the Envoy's belt (+190..+204) sit
  const belt = { z0: AT.meta.zhip - 48, z1: AT.meta.zhip - 34 };
  const style = q => {
    const { a, s, z } = q;
    const aw = a + 1.6 * Math.sin(z / 37 + a / 17.5) * smooth(0, 40, s);           // folds sway a little
    const depth = 0.85 + 0.3 * (fbm(a / 22, z / 45, seed + 61, 2) - 0.5) - 0.6 * smooth(8, 90, s);
    let sh = 1 + (at(rel, aw) - 1) * Math.max(0.2, depth);
    sh += (folds(a, z, seed + 11, 27) - 0.5) * 0.26 * smooth(10, 90, s);           // new folds further down
    sh += 0.05 * (fbm(a / 1.8, z / 14, seed + 77, 2) - 0.5);                      // short streaks
    sh -= 0.08 * smooth(smax * 0.45, smax, s);                                    // a little darker to the hips
    sh -= 0.10 * smooth(belt.z0 - 4, belt.z0, z) * (z < belt.z0 ? 1 : 0);          // cloth gathered above the belt
    sh -= 0.16 * (1 - smooth(belt.z1, belt.z1 + 4, z)) * (z > belt.z1 ? 1 : 0);    // shadow under it
    let c = mix(at(base, aw), at(wide, aw), smooth(4, 60, s)).map(v => v * sh);
    if (z >= belt.z0 && z <= belt.z1) {                                           // the belt: garment colour, dark leather-like
      const u = (z - belt.z0) / (belt.z1 - belt.z0);
      const w = at(wide, a), L = lum(w), dark = w.map(v => (v * 0.35 + L * 0.15) * 0.62);
      let b = 1 + 0.12 * Math.sin(Math.PI * u) - 0.35 * (u < 0.1 || u > 0.9 ? 1 : 0) + 0.08 * (fbm(a / 3, u * 4, seed + 9, 2) - 0.5);
      c = dark.map(v => v * b * 1.6);
      if (Math.abs(a) < 4.2 && u > 0.12 && u < 0.88) {                             // brass buckle at the front
        const rim = Math.abs(a) > 3 || u < 0.24 || u > 0.76, pin = Math.abs(a) < 0.5;
        const k = rim ? 1.05 + 0.15 * Math.sin(u * 9) : pin ? 0.9 : 0.35;
        c = [168, 132, 66].map(v => v * k);
      }
    }
    const g = (fbm(a * 0.9, s * 0.9, seed + 5, 2) - 0.5) * 9;                     // fine grain
    return c.map(v => v + g);
  };
  // rim offset carried down a short way, as in bake.js
  const genTop = cols.map((_, j) => style(AT.attr[j * ROWS + 1]));
  const rimSm = rimCol.map((c, j) => { if (!c) return null; const acc = [0, 0, 0]; let n = 0; for (let d = -1; d <= 1; d++) { const q = rimCol[clamp(j + d, 0, NC - 1)]; if (!q) continue; const w = d ? 1 : 2; for (let k = 0; k < 3; k++) acc[k] += q[k] * w; n += w; } return acc.map(v => v / n); });
  const offs = cols.map((_, j) => rimSm[j] ? rimSm[j].map((v, k) => v - genTop[j][k]) : [0, 0, 0]);
  const offSm = offs.map((_, j) => { const acc = [0, 0, 0]; let n = 0; for (let d = -2; d <= 2; d++) { const q = offs[clamp(j + d, 0, NC - 1)]; for (let k = 0; k < 3; k++) acc[k] += q[k]; n++; } return acc.map(v => v / n); });
  const capC = meanC.map(v => v * 0.3);
  const shade = q => {
    if (q.cap) return capC;
    const jf = clamp(q.j, 0, NC - 1), j0 = Math.floor(jf), j1 = Math.min(NC - 1, j0 + 1), fj = jf - j0;
    let c = style(q);
    const off = mix(offSm[j0], offSm[j1], fj), dec = Math.exp(-Math.max(0, q.s) / 6);
    c = c.map((v, k) => v + off[k] * dec);
    if (rimSm[j0] && rimSm[j1]) c = mix(mix(rimSm[j0], rimSm[j1], fj), c, smooth(0, 3.5, q.s));
    return c.map(v => clamp(v, 0, 255));
  };
  // rasterize in UV space
  const img = PNG.create(W, H, [0, 0, 0, 0]), filled = new Uint8Array(W * H), attr = AT.attr, tri = body.idx;
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
      let q;
      if (Q[0].cap) q = { cap: 1 };
      else { q = {}; for (const f of ['th', 's', 'z', 'a', 'j']) q[f] = w0 * Q[0][f] + w1 * Q[1][f] + w2 * Q[2][f]; }
      const c = shade(q);
      img.data[o * 4] = c[0]; img.data[o * 4 + 1] = c[1]; img.data[o * 4 + 2] = c[2]; img.data[o * 4 + 3] = 255;
      filled[o] = (w0 >= 0 && w1 >= 0 && w2 >= 0) ? 2 : 1;
    }
  }
  for (let y = H - 12; y < H; y++) for (let x = W - 12; x < W; x++) { const o = y * W + x; img.data.set([...capC.map(Math.round), 255], o * 4); filled[o] = 2; }
  for (let pass = 0; pass < 24; pass++) { // dilate so mips do not bleed black
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = y * W + x; if (filled[o]) continue;
      const acc = [0, 0, 0]; let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const oo = yy * W + xx; if (!filled[oo]) continue; for (let k = 0; k < 3; k++) acc[k] += img.data[oo * 4 + k]; n++; }
      if (n) add.push([o, acc.map(v => v / n)]);
    }
    for (const [o, c] of add) { img.data[o * 4] = c[0]; img.data[o * 4 + 1] = c[1]; img.data[o * 4 + 2] = c[2]; img.data[o * 4 + 3] = 255; filled[o] = 1; }
  }
  for (let o = 0; o < W * H; o++) if (!filled[o]) img.data.set([...meanC.map(Math.round), 255], o * 4);
  PNG.encode(path.join(dir, 'body_diff.png'), img, false);
  return { profileSamples: pN, filled: known.length };
}
module.exports = { bake };
if (require.main === module) for (const id of process.argv.slice(2)) console.log(id, JSON.stringify(bake(id)));
