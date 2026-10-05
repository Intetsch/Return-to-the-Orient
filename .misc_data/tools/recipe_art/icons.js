'use strict';
// Painted colour icons (128x128) in the vanilla recipe-icon style: soft shaded objects with a dark outline.
const OUT = 'rgb(46,28,20)';
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function shadeCol(base, lam, spec, o = {}) {
  const dark = o.dark ?? mix(base, [20, 10, 8], 0.72);
  let c = mix(dark, base, clamp(lam * 1.15));
  c = mix(c, o.lit ?? mix(base, [255, 250, 235], 0.55), clamp((lam - 0.75) * 2.2));
  return mix(c, [255, 255, 250], clamp(spec * (o.specK ?? 1)));
}
function lamOf(n) { return Math.max(0, dot3(n, LIGHT)) * 0.85 + 0.18; }
function specOf(n, p = 40) { return Math.pow(Math.max(0, dot3(n, HALF)), p); }
function quad(a, b, c, d, col) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.35; ctx.fill(); ctx.stroke(); }
// paint a vessel; colFn(t, th) -> base colour
function paintVessel(v, colFn, o = {}) {
  erase(v.path());
  const NT = o.nt ?? 46, NA = o.na ?? 48;
  for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) {
    const t0 = j / NT, t1 = (j + 1) / NT, a0 = -Math.PI / 2 + Math.PI * i / NA, a1 = -Math.PI / 2 + Math.PI * (i + 1) / NA;
    const tm = (t0 + t1) / 2, am = (a0 + a1) / 2, n = v.normal(am, tm);
    quad(v.pt(a0, t0), v.pt(a1, t0), v.pt(a1, t1), v.pt(a0, t1), rgb(shadeCol(colFn(tm, am), lamOf(n), specOf(n, o.shine ?? 40) * (o.gloss ?? 1), o)));
  }
  ctx.fillStyle = OUT;
  v.outline({ w: o.w ?? 1.5, rim: o.rim ?? true, rimW: o.rimW ?? 0.8 });
}
// fill a path pixel-cell wise from a colour function in screen space
function paintRegion(path, bbox, colFn, cell = 0.5) {
  ctx.save(); ctx.clip(path);
  for (let y = bbox[1]; y < bbox[3]; y += cell) for (let x = bbox[0]; x < bbox[2]; x += cell) { ctx.fillStyle = rgb(colFn(x + cell / 2, y + cell / 2)); ctx.fillRect(x, y, cell + 0.08, cell + 0.08); }
  ctx.restore();
}
function inkOutline(pts, w = 1.3) { ctx.fillStyle = OUT; contour(pts.map(p => [...p, 1]), { w, double: false, jit: 0.1 }); }
function paintInnerRim(v, col) {
  const [y1, r1] = v.yr(1); const pts = ellipsePts(v.cx, y1, r1, r1 * v.k, 0, Math.PI * 2, 80); const p = polyPath(pts); erase(p);
  paintRegion(p, [v.cx - r1, y1 - r1 * v.k, v.cx + r1, y1 + r1 * v.k], (x, y) => { const u = (x - v.cx) / r1; return mix(col, mix(col, [20, 10, 8], 0.6), clamp(0.6 - u * 0.5)); });
}
function paintLiquid(v, t, colFn, o = {}) {
  const [y, r0] = v.yr(t); const r = r0 * 0.985; const pts = ellipsePts(v.cx, y, r, r * v.k, 0, Math.PI * 2, 80); const p = polyPath(pts); erase(p);
  paintRegion(p, [v.cx - r, y - r * v.k, v.cx + r, y + r * v.k], (x, yy) => colFn((x - v.cx) / r, (yy - y) / (r * v.k)));
  ctx.fillStyle = 'rgba(46,28,20,0.8)'; contour(pts.map(q => [...q, 1]), { w: 0.6, double: false });
  return { path: p, y, r };
}
const COFFEE = (u, w) => { const d = Math.hypot(u, w); const hl = Math.hypot(u + 0.3, w + 0.3); let c = mix([92, 54, 30], [40, 22, 14], clamp(d * 0.9)); c = mix(c, [168, 112, 62], smooth(0.78, 0.98, d) * 0.7); return mix(c, [230, 205, 170], smooth(0.22, 0.0, hl) * 0.8); };
const PORCELAIN = [236, 228, 212], COBALT = [38, 66, 150], GOLD = [214, 168, 70];
function porcelainCol(bands) { return (t, th) => { for (const [a, b, c] of bands) if (t >= a && t <= b) return c; return PORCELAIN; }; }

function iFincan(cx, by, s, o = {}) {
  // saucer
  const sa = V(cx, by + 3 * s, s, [[0, 30], [2, 40], [5, 53], [8, 62], [9.5, 64]], { k: 0.3 });
  paintVessel(sa, porcelainCol([[0.85, 1, GOLD]]), { w: 1.4 });
  const [y1, r1] = sa.yr(1); const sp = polyPath(ellipsePts(cx, y1, r1, r1 * 0.3, 0, 7, 80)); erase(sp);
  paintRegion(sp, [cx - r1, y1 - r1 * 0.3, cx + r1, y1 + r1 * 0.3], (x, y) => { const u = (x - cx) / r1, w = (y - y1) / (r1 * 0.3); const d = Math.hypot(u, w); let c = d > 0.72 && d < 0.8 ? COBALT : PORCELAIN; return mix(c, [120, 110, 100], clamp(0.25 - u * 0.15 + (d < 0.55 && u > 0 ? 0.25 : 0))); });
  inkOutline(ellipsePts(cx, y1, r1, r1 * 0.3), 1.2);
  const v = V(cx, by, s, [[0, 15], [2, 18], [10, 24], [26, 30], [38, 33], [42, 34]], { k: 0.3 });
  // handle
  const [ya] = v.yr(0.86), [yb] = v.yr(0.32), [, ra] = v.yr(0.86), [, rb] = v.yr(0.32);
  const hc = bez([cx + ra - 2 * s, ya], [cx + ra + 26 * s, ya - 5 * s], [cx + rb + 26 * s, yb + 6 * s], [cx + rb - 2 * s, yb], 40);
  paintTube(hc, q => (3.4 - 0.9 * Math.sin(q * Math.PI)) * s, PORCELAIN);
  paintVessel(v, porcelainCol([[0.55, 0.74, COBALT], [0.76, 0.8, GOLD], [0.93, 1.0, GOLD]]), { w: 1.6, shine: 60 });
  paintInnerRim(v, PORCELAIN);
  return { v, lq: paintLiquid(v, 0.9, o.liq ?? COFFEE) };
}
function iFinjan(cx, by, s, o = {}) {
  const v = V(cx, by, s, [[0, 11], [2, 13], [4, 12], [10, 16], [20, 21], [27, 23], [29, 23.5]], { k: 0.32 });
  paintVessel(v, porcelainCol([[0.0, 0.18, GOLD], [0.6, 0.82, COBALT], [0.92, 1, GOLD]]), { w: 1.5, shine: 60 });
  paintInnerRim(v, PORCELAIN);
  return { v, lq: paintLiquid(v, 0.86, COFFEE) };
}
function paintTube(center, rad, col, o = {}) {
  const C = resample(center, 0.4); const n = C.length; const L = [], Rt = [];
  for (let i = 0; i < n; i++) { const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; const r = rad(i / (n - 1)); L.push([C[i][0] - dy * r, C[i][1] + dx * r]); Rt.push([C[i][0] + dy * r, C[i][1] - dx * r]); }
  const shape = polyPath([...L, ...Rt.slice().reverse()]); erase(shape);
  for (let i = 0; i < n - 1; i++) {
    const K = 6; for (let k = 0; k < K; k++) {
      const f0 = k / K, f1 = (k + 1) / K, P = (j, f) => [lerp(L[j][0], Rt[j][0], f), lerp(L[j][1], Rt[j][1], f)];
      const nx = (Rt[i][0] - L[i][0]), ny = (Rt[i][1] - L[i][1]); const nl = Math.hypot(nx, ny) || 1; const fm = (f0 + f1) / 2 * 2 - 1;
      const nrm = norm3([nx / nl * fm, -ny / nl * fm, Math.sqrt(Math.max(0, 1 - fm * fm))]);
      quad(P(i, f0), P(i + 1, f0), P(i + 1, f1), P(i, f1), rgb(shadeCol(col, lamOf(nrm), specOf(nrm, 30) * (o.gloss ?? 0.6), o)));
    }
  }
  inkOutline(L, o.w ?? 1.2); inkOutline(Rt, o.w ?? 1.2);
  if (o.capEnd) inkOutline([L[n - 1], Rt[n - 1]], o.w ?? 1.2);
  if (o.capStart) inkOutline([L[0], Rt[0]], o.w ?? 1.2);
}
function iBlob(shp, cx, cy, size, base, o = {}) { // shaded convex-ish blob with highlight
  const p = polyPath(shp); erase(p);
  const bb = [cx - size * 1.2, cy - size * 1.2, cx + size * 1.2, cy + size * 1.2];
  paintRegion(p, bb, (x, y) => { const u = (x - cx) / size, w = (y - cy) / size; const z = Math.sqrt(Math.max(0, 1 - Math.min(1, u * u + w * w))); const n = norm3([u, -w, z + 0.25]); return shadeCol(base, lamOf(n), specOf(n, o.shine ?? 25) * (o.gloss ?? 0.8), o); }, o.cell ?? 0.5);
  inkOutline(shp, o.w ?? 1.2);
}
function iBean(x, y, len, rot) {
  const wdt = len * 0.66, T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  const shp = ellipsePts(0, 0, len / 2, wdt / 2, 0, Math.PI * 2, 40).map(T);
  iBlob(shp, x, y, len * 0.5, [120, 66, 36], { dark: [36, 18, 10], gloss: 0.9 });
  const cr = []; for (let i = 0; i <= 16; i++) { const t = -0.42 + 0.84 * i / 16; cr.push(T([t * len, Math.sin(t * 6.5) * wdt * 0.1])); }
  ctx.fillStyle = OUT; line(cr.map((p, i) => [...p, 1.4 - Math.abs(i - 8) / 9]), { w: 1.3, taper: 0.3 });
}
function iDate(x, y, len, rot) {
  const wdt = len * 0.42, T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  const shp = []; for (let i = 0; i <= 50; i++) { const a = i / 50 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); const r = 1 + 0.04 * Math.sin(a * 5 + x); shp.push(T([c * len / 2 * r, s * wdt / 2 * r * (1 - 0.14 * c)])); }
  iBlob(shp, x, y, len * 0.42, [168, 70, 28], { dark: [52, 14, 6], gloss: 1.4, shine: 14, lit: [236, 150, 90] });
  ctx.fillStyle = 'rgba(40,12,6,0.75)';
  for (const [yy, a0, a1] of [[-0.18, -0.36, 0.2], [0.05, -0.3, 0.34], [0.22, -0.12, 0.3], [-0.02, 0.12, 0.42]]) line(bez([len * a0, yy * wdt], [len * (a0 * 0.6 + a1 * 0.4), yy * wdt + 1.2], [len * (a0 * 0.4 + a1 * 0.6), yy * wdt - 1.2], [len * a1, yy * wdt], 14).map(T).map(p => [...p, 0.8]), { w: 0.7, taper: 0.4, jit: 0 });
  const c = T([-len / 2 + 1.6, 0]); iBlob(ellipsePts(c[0], c[1], 1.8, 2.8, 0, 7, 14, rot), c[0], c[1], 3, [196, 156, 92], { gloss: 0.3, w: 0.8 });
}
function iPod(x, y, len, rot) {
  const wdt = len * 0.46, T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  const loc = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, c = Math.cos(a); loc.push([c * len / 2, Math.sin(a) * wdt / 2 * Math.pow(1 - Math.pow(Math.abs(c), 2.2), 0.5) * 1.1]); }
  iBlob(loc.map(T), x, y, len * 0.45, [150, 176, 92], { dark: [52, 72, 28], gloss: 0.5 });
  ctx.fillStyle = 'rgba(46,40,20,0.6)'; line(bez([-len * 0.42, 0], [-len * 0.15, wdt * 0.15], [len * 0.15, wdt * 0.15], [len * 0.42, 0], 12).map(T).map(p => [...p, 0.8]), { w: 0.6, taper: 0.4 });
}
function iPetal(x, y, s, rot, o = {}) {
  const sq = o.sq ?? 1, T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + (p[0] * Math.sin(rot) + p[1] * Math.cos(rot)) * sq];
  const loc = catmull([[0, 0], [s * 0.22, -s * 0.3], [s * 0.6, -s * 0.55], [s * 0.95, -s * 0.42], [s * 1.04, -s * 0.12], [s * 0.96, 0.02 * s], [s * 1.05, s * 0.2], [s * 0.92, s * 0.48], [s * 0.55, s * 0.52], [s * 0.2, s * 0.28], [0, 0]], 6).map(T);
  const c = T([s * 0.55, 0]); iBlob(loc, c[0], c[1], s * 0.6, o.col ?? [222, 72, 102], { dark: [120, 18, 48], gloss: 0.4, w: 0.9 });
}
function iRose(x, y, S) { // stacked petal rings, pink
  const rings = [[1.0, 6, 0.0], [0.78, 5, 0.6], [0.56, 4, 1.1], [0.36, 3, 1.9]];
  for (const [rk, n, off] of rings) {
    for (let i = 0; i < n; i++) {
      const a = off + i * Math.PI * 2 / n; const px = x + Math.cos(a) * S * rk * 0.45, py = y + Math.sin(a) * S * rk * 0.32;
      const shp = ellipsePts(px, py, S * rk * 0.55, S * rk * 0.42, 0, 7, 30, a);
      iBlob(shp, px, py - S * 0.05, S * rk * 0.55, mix([236, 96, 124], [200, 40, 80], 1 - rk), { dark: [110, 14, 44], gloss: 0.35, w: 0.9 });
    }
  }
  ctx.fillStyle = OUT; const sp = []; for (let i = 0; i <= 60; i++) { const f = i / 60, a = f * Math.PI * 4, r = S * 0.2 * (1 - f * 0.85); sp.push([x + Math.cos(a) * r, y - S * 0.02 + Math.sin(a) * r * 0.75, 1 - f * 0.4]); }
  line(sp, { w: 1.1, taper: 0.1 });
}
function iLeaf(x, y, len, rot, col = [92, 142, 62]) {
  const wdt = len * 0.42, T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  const top = [], bot = []; for (let i = 0; i <= 24; i++) { const f = i / 24, ww = Math.sin(Math.pow(f, 0.8) * Math.PI) * wdt / 2; top.push([f * len, -ww]); bot.push([f * len, ww]); }
  const shp = [...top, ...bot.reverse()].map(T); const c = T([len * 0.45, 0]);
  iBlob(shp, c[0], c[1], len * 0.5, col, { dark: [28, 56, 22], gloss: 0.5, w: 1.0 });
  ctx.fillStyle = 'rgba(30,50,20,0.7)'; line([[len * 0.05, 0], [len * 0.9, 0]].map(T).map(p => [...p, 0.8]), { w: 0.7, taper: 0.4 });
}
function steamW(x, y, h, n = 3, gap = 6) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let k = 0; k < n; k++) { const pts = []; const ph = k * 2.1, x0 = x + (k - (n - 1) / 2) * gap; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([x0 + Math.sin(ph + t * 5) * 3 * (0.4 + t), y - t * h]); } line(pts, { w: 2.4, taper: 0.5, jit: 0 }); }
  ctx.fillStyle = 'rgba(46,28,20,0.35)';
  for (let k = 0; k < n; k++) { const pts = []; const ph = k * 2.1, x0 = x + (k - (n - 1) / 2) * gap; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([x0 + Math.sin(ph + t * 5) * 3 * (0.4 + t) + 1.2, y - t * h]); } line(pts, { w: 0.6, taper: 0.5, jit: 0 }); }
}
function iDallah(cx, by, s) {
  const BR = [206, 156, 66];
  const bodyV = V(cx, by, s, [[0, 30], [3, 33], [6, 31], [9, 29], [18, 38], [32, 44], [46, 40], [58, 29], [67, 20], [75, 18], [85, 23], [95, 29], [100, 31]], { k: 0.3 });
  const [yA, rA] = bodyV.yr(0.86), [yB, rB] = bodyV.yr(0.35);
  paintTube(catmull([[cx + rA - 3 * s, yA], [cx + rA + 22 * s, yA - 6 * s], [cx + rA + 32 * s, yA + 14 * s], [cx + rA + 28 * s, yA + 40 * s], [cx + rB + 14 * s, yB - 4 * s], [cx + rB - 4 * s, yB + 2 * s]], 8), q => 3.6 * s, BR, { gloss: 1 });
  const [yS, rS] = bodyV.yr(0.42);
  const spP = catmull([[cx - rS + 6 * s, yS + 4 * s], [cx - rS - 12 * s, yS - 12 * s], [cx - rS - 24 * s, yS - 34 * s], [cx - rS - 32 * s, yS - 62 * s], [cx - rS - 40 * s, yS - 82 * s]], 10);
  const tip = spP[spP.length - 1];
  const beak = catmull([[tip[0] + 7 * s, tip[1] + 2 * s], [tip[0] - 6 * s, tip[1] - 9 * s], [tip[0] - 22 * s, tip[1] - 10 * s], [tip[0] - 30 * s, tip[1] - 2 * s], [tip[0] - 20 * s, tip[1] - 3 * s], [tip[0] - 7 * s, tip[1] + 4 * s]], 6);
  iBlob(beak, tip[0] - 10 * s, tip[1] - 6 * s, 14 * s, BR, { gloss: 1.2, w: 1.1 });
  paintTube(spP, q => lerp(8.5, 3.6, Math.pow(q, 0.8)) * s, BR, { gloss: 1 });
  paintVessel(bodyV, (t) => (t > 0.6 && t < 0.67) || t < 0.08 ? mix(BR, [120, 70, 20], 0.5) : BR, { w: 1.6, shine: 30, gloss: 1.2, lit: [255, 236, 170] });
  const lid = V(cx, bodyV.yr(1)[0] + 1 * s, s, [[0, 27], [3, 26], [8, 22], [14, 15], [18, 10], [20, 8]], { k: 0.3 });
  paintVessel(lid, () => BR, { w: 1.4, rim: false, shine: 30, gloss: 1.2, lit: [255, 236, 170] });
  const fin = V(cx, lid.yr(1)[0] + 1 * s, s, [[0, 8], [3, 6], [6, 7.5], [9, 5], [14, 3.5], [24, 2], [36, 0.6]], { k: 0.3 });
  paintVessel(fin, () => BR, { w: 1.2, rim: false, shine: 30, lit: [255, 236, 170] });
}
function iGlass(cx, by, s) {
  const outer = V(cx, by, s, [[0, 23], [3, 25], [8, 24], [30, 25], [60, 28], [88, 31], [92, 31.5]], { k: 0.3 });
  const inner = V(cx, by, s, [[8, 21], [30, 23], [60, 26], [84, 29]], { k: 0.3 });
  erase(outer.path());
  const lv = [0.42, 0.62];
  // liquid layers via mesh
  const NT = 46, NA = 40;
  for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) {
    const t0 = j / NT, t1 = (j + 1) / NT, a0 = -Math.PI / 2 + Math.PI * i / NA, a1 = -Math.PI / 2 + Math.PI * (i + 1) / NA, tm = (t0 + t1) / 2, am = (a0 + a1) / 2;
    const base = tm < lv[0] ? [70, 40, 24] : tm < lv[1] ? mix([70, 40, 24], [196, 150, 104], smooth(lv[0], lv[1], tm)) : [238, 222, 196];
    const n = inner.normal(am, tm);
    quad(inner.pt(a0, t0), inner.pt(a1, t0), inner.pt(a1, t1), inner.pt(a0, t1), rgb(shadeCol(base, lamOf(n) * 0.9 + 0.1, 0)));
  }
  // foam top
  const [yt, rt] = inner.yr(1); const tp = polyPath(ellipsePts(cx, yt, rt, rt * 0.3, 0, 7, 60)); erase(tp);
  paintRegion(tp, [cx - rt, yt - rt * 0.3, cx + rt, yt + rt * 0.3], (x, y) => mix([246, 236, 214], [196, 170, 134], clamp(0.2 + (x - cx) / rt * 0.35)));
  // glass tint + thick base
  ctx.save(); ctx.clip(outer.path());
  const g = ctx.createLinearGradient(cx - 32 * s, 0, cx + 32 * s, 0); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.18, 'rgba(255,255,255,0.08)'); g.addColorStop(0.75, 'rgba(160,190,200,0.12)'); g.addColorStop(1, 'rgba(90,110,120,0.35)');
  ctx.fillStyle = g; ctx.fillRect(cx - 40 * s, by - 100 * s, 80 * s, 110 * s);
  ctx.fillStyle = 'rgba(200,220,225,0.55)'; ctx.fill(polyPath([...ellipsePts(cx, outer.yr(0.09)[0], outer.yr(0.09)[1], outer.yr(0.09)[1] * 0.3, Math.PI, 0, 30), ...ellipsePts(cx, by, 23 * s, 23 * s * 0.3, 0, Math.PI, 30)]));
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const th of [-1.05, -0.9]) { const pts = []; for (let k = 12; k <= 86; k++) pts.push([...outer.pt(th, k / 100), 1]); line(pts, { w: th < -1 ? 2.2 : 1.0, taper: 0.3, jit: 0 }); }
  ctx.restore();
  ctx.fillStyle = OUT; outer.outline({ w: 1.4, rimW: 0.7 });
}
function iDipper(x0, y0, x1, y1, s) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const WOOD = [196, 146, 84];
  paintTube([[x0, y0], [x0 + dx * 0.62, y0 + dy * 0.62]], q => (2.2 + q * 0.5) * s, WOOD, { capStart: true });
  const f0 = 0.6, ridges = 5, wd = f => { const g = (f - f0) / (1 - f0); return (5.5 + 4 * Math.pow(Math.sin(Math.PI * clamp(g * 0.92 + 0.04)), 0.45) * (0.72 + 0.28 * Math.abs(Math.cos(g * Math.PI * ridges)))) * s; };
  const A = [], B = []; for (let i = 0; i <= 60; i++) { const f = f0 + (1 - f0) * i / 60, px = x0 + dx * f, py = y0 + dy * f, w = wd(f); A.push([px + nx * w, py + ny * w]); B.push([px - nx * w, py - ny * w]); }
  const hp = polyPath([...A, ...B.slice().reverse()]); erase(hp);
  paintRegion(hp, [Math.min(x0, x1) - 14, Math.min(y0, y1) - 14, Math.max(x0, x1) + 14, Math.max(y0, y1) + 14], (x, y) => {
    const f = ((x - x0) * ux + (y - y0) * uy) / L, side = ((x - x0) * nx + (y - y0) * ny) / wd(clamp(f, f0, 1));
    const groove = Math.abs(Math.cos(((f - f0) / (1 - f0)) * Math.PI * ridges)) < 0.3;
    const n = norm3([nx * side, -ny * side, Math.sqrt(Math.max(0, 1 - side * side))]);
    // honey coating on the head
    const base = mix(WOOD, [232, 156, 34], 0.75);
    return shadeCol(groove ? mix(base, [120, 60, 10], 0.5) : base, lamOf(n), specOf(n, 20) * 0.9);
  });
  inkOutline(A, 1.2); inkOutline(B, 1.2);
  ctx.fillStyle = OUT;
  for (let k = 1; k < ridges; k++) { const f = f0 + (1 - f0) * (k + 0.5) / ridges; const px = x0 + dx * f, py = y0 + dy * f, w = wd(f) * 0.96; line(bez([px + nx * w, py + ny * w], [px + nx * w * 0.4 + ux * 2 * s, py + ny * w * 0.4 + uy * 2 * s], [px - nx * w * 0.4 + ux * 2 * s, py - ny * w * 0.4 + uy * 2 * s], [px - nx * w, py - ny * w], 12).map(p => [...p, 0.8]), { w: 0.8, taper: 0.15, jit: 0 }); }
  return { head: [x0 + dx * 0.82, y0 + dy * 0.82], w: wd(0.82) };
}
function iHoneyDrip(pts, wid) { paintTube(catmull(pts, 8), q => wid * (1 - 0.3 * q), [236, 160, 36], { gloss: 1.3, capEnd: false, w: 1.0 }); const e = pts[pts.length - 1]; iBlob(ellipsePts(e[0], e[1], wid * 1.3, wid * 1.5, 0, 7, 20), e[0], e[1], wid * 1.4, [236, 160, 36], { gloss: 1.4, w: 1.0 }); }
function iShadow(cx, cy, rx, ry, a = 0.3) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx); g.addColorStop(0, `rgba(30,18,12,${a})`); g.addColorStop(1, 'rgba(30,18,12,0)'); ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, 7); ctx.fill(); ctx.restore(); }

const ICONS = {
  plain: { seed: 3, draw() { iShadow(66, 112, 58, 12); iFincan(62, 100, 0.86); steamW(60, 60, 30); iBean(22, 112, 15, 0.5); iBean(108, 116, 14, 2.2); } },
  milk: { seed: 4, draw() { iShadow(64, 118, 46, 10); iGlass(62, 116, 0.98); iBean(22, 114, 15, 0.6); iBean(106, 116, 14, 2.4); } },
  cardamom: { seed: 5, draw() { iShadow(56, 108, 44, 9); iDallah(52, 106, 0.62); iShadow(96, 120, 26, 6); iFinjan(94, 118, 0.85); iPod(18, 116, 19, 0.4); iPod(40, 122, 18, -0.5); iPod(116, 102, 16, 1.4); } },
  dates: { seed: 6, draw() { iShadow(44, 108, 34, 8); iFinjan(40, 104, 1.02); steamW(40, 72, 22, 2, 7); iShadow(94, 118, 34, 8); iDate(92, 94, 32, -0.55); iDate(104, 108, 32, 0.15); iDate(80, 112, 31, -0.2); iDate(98, 122, 30, 0.05); } },
  rose: { seed: 7, draw() { iShadow(68, 112, 56, 12); const { lq } = iFincan(66, 100, 0.84); ctx.save(); ctx.clip(lq.path); iPetal(52, lq.y + 1, 14, 0.2, { sq: 0.5 }); iPetal(80, lq.y + 2, 13, 2.9, { sq: 0.5 }); ctx.restore(); iLeaf(98, 118, 22, -0.3); iRose(104, 108, 22); iPetal(10, 116, 12, -0.3, { sq: 0.7 }); } },
  honey: { seed: 8, draw() { iShadow(56, 112, 52, 11); iFincan(52, 100, 0.8); steamW(50, 62, 26); const hd = iDipper(64, 124, 122, 84, 0.95); iHoneyDrip([[hd.head[0] - 1, hd.head[1] + hd.w * 0.8], [hd.head[0], hd.head[1] + hd.w + 8], [hd.head[0] - 1, hd.head[1] + hd.w + 14]], 2.2); } },
};
