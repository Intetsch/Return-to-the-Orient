// ink.js - small pen & ink engraving renderer for Anno recipe book drawings.
// Draws black ink with alpha on a transparent canvas; the page converts it to the
// vanilla ink colour (58,36,29) at the end.
'use strict';
const W = 420, H = 400, SS = 2;            // logical size, supersampling factor
let ctx;                                   // current drawing context (logical units)
let rand = mulberry32(7);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seed(s) { rand = mulberry32(s); buildNoise(); }
const R = () => rand();
const rr = (a, b) => a + (b - a) * rand();
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

let NT = new Float32Array(4096);
function buildNoise() { for (let i = 0; i < NT.length; i++) NT[i] = rand() * 2 - 1; }
buildNoise();
function noise(t) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); const a = NT[(i % 4096 + 4096) % 4096], b = NT[((i + 1) % 4096 + 4096) % 4096]; return a + (b - a) * u; }

function newCanvas(w = W, h = H, ss = SS) {
  const c = document.createElement('canvas'); c.width = w * ss; c.height = h * ss;
  const g = c.getContext('2d'); g.scale(ss, ss); g.fillStyle = '#000'; g.strokeStyle = '#000';
  g.lineCap = 'round'; g.lineJoin = 'round';
  return { c, g };
}

// ---------------------------------------------------------------- strokes
function resample(pts, step) {
  const out = [pts[0]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d === 0) continue;
    let s = step - carry;
    while (s <= d) { const t = s / d; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, ...(a.length > 2 ? [lerp(a[2], b[2], t)] : [])]); s += step; }
    carry = d - (s - step);
  }
  const last = pts[pts.length - 1]; const ol = out[out.length - 1];
  if (Math.hypot(last[0] - ol[0], last[1] - ol[1]) > step * 0.3) out.push(last);
  return out;
}
function plen(pts) { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; }

// A hand drawn ribbon along pts. Optional third coordinate per point = width multiplier.
// o: w (width), jit (wobble amplitude), taper (fraction of length), wv (width variation), alpha, step
function line(pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const w = o.w ?? 1, jit = o.jit ?? 0.35, taperL = o.taper ?? 0.2, wv = o.wv ?? 0.35, alpha = o.alpha ?? 1;
  const P = o.noResample ? pts : resample(pts, o.step ?? 1.0);
  if (P.length < 2) return;
  const L = plen(P) || 1; const off = R() * 3000, off2 = R() * 3000;
  const tlen = Math.max(taperL * L, 0.001);
  const left = [], right = []; let acc = 0;
  const ta = o.taperStart ?? 1, tb = o.taperEnd ?? 1;
  for (let i = 0; i < P.length; i++) {
    if (i > 0) acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const nx = -dy, ny = dx;
    let tp = 1;
    if (ta) tp = Math.min(tp, acc / tlen);
    if (tb) tp = Math.min(tp, (L - acc) / tlen);
    tp = Math.pow(clamp(tp), 0.7);
    const m = (P[i].length > 2 ? P[i][2] : 1);
    const ww = Math.max(0.05, w * m * (1 + wv * noise(off + acc * 0.09)) * (0.18 + 0.82 * tp)) / 2;
    const j = jit * noise(off2 + acc * 0.05);
    const cx = P[i][0] + nx * j, cy = P[i][1] + ny * j;
    left.push([cx + nx * ww, cy + ny * ww]); right.push([cx - nx * ww, cy - ny * ww]);
  }
  ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath(); ctx.globalAlpha = alpha; ctx.fill(); ctx.globalAlpha = 1;
}
// Draw a contour twice with slight offsets, like a sketcher going over a line.
function contour(pts, o = {}) {
  line(pts, { taper: 0.08, ...o });
  if (o.double !== false) line(pts.map(p => [p[0] + rr(-0.4, 0.4), p[1] + rr(-0.4, 0.4), p[2]]), { taper: 0.25, ...o, w: (o.w ?? 1) * 0.55, alpha: (o.alpha ?? 1) * 0.7, jit: (o.jit ?? 0.35) * 1.6 });
}
// Split a dense polyline by a darkness function; draw pieces whose darkness exceeds th with width ~ darkness.
function hatchPolyline(pts, dfn, o = {}) {
  const th = o.th ?? 0.2, w = o.w ?? 0.9, minLen = o.minLen ?? 2.5;
  let seg = [];
  const flush = () => { if (seg.length > 1 && plen(seg) > minLen) line(seg, { w, taper: o.taper ?? 0.3, jit: o.jit ?? 0.25, wv: 0.25, noResample: true, alpha: o.alpha ?? 1 }); seg = []; };
  for (const p of pts) {
    const d = dfn(p[0], p[1], p);
    const th2 = th + (o.ragged ?? 0.06) * noise(p[0] * 0.13 + p[1] * 0.07 + (o.nOff ?? 0));
    const wmin = o.wmin ?? 0.25;
    if (d > th2) seg.push([p[0], p[1], clamp(wmin + (1 - wmin) * (d - th2) / (1 - th2) * (o.gain ?? 1.3), 0.15, o.wmax ?? 1.8)]);
    else flush();
  }
  flush();
}
// Straight hatching across a clip path at an angle.
function hatchRegion(path, angle, spacing, dfn, o = {}) {
  ctx.save(); ctx.clip(path);
  const b = o.bbox ?? [0, 0, W, H];
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, rad = Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 4;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let s = -rad; s <= rad; s += spacing * rr(0.85, 1.15)) {
    const pts = [];
    const wav = o.wave ?? 0.6, wo = R() * 999;
    for (let t = -rad; t <= rad; t += 1.2) {
      const bend = (o.bend ? o.bend(t / rad) : 0) + wav * noise(wo + t * 0.04);
      pts.push([cx + ca * t - sa * (s + bend), cy + sa * t + ca * (s + bend)]);
    }
    hatchPolyline(pts, dfn, o);
  }
  ctx.restore();
}
function stipple(path, n, dfn, o = {}) {
  ctx.save(); if (path) ctx.clip(path);
  const b = o.bbox ?? [0, 0, W, H];
  for (let i = 0; i < n; i++) {
    const x = rr(b[0], b[2]), y = rr(b[1], b[3]);
    if (R() < dfn(x, y)) { const r = (o.r ?? 0.55) * rr(0.6, 1.3); ctx.beginPath(); ctx.ellipse(x, y, r, r * rr(0.7, 1), R() * 3, 0, 7); ctx.globalAlpha = o.alpha ?? 0.9; ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.restore();
}
function erase(path) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(path); ctx.restore(); }
function polyPath(pts, close = true) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (const q of pts) p.lineTo(q[0], q[1]); if (close) p.closePath(); return p; }
function ellipsePts(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 90, rot = 0) {
  const pts = []; const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); }
  return pts;
}
function bez(p0, p1, p2, p3, n = 40) { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return pts; }
function catmull(cp, n = 12) { // open Catmull-Rom through control points
  const pts = [];
  for (let i = 0; i < cp.length - 1; i++) {
    const p0 = cp[Math.max(0, i - 1)], p1 = cp[i], p2 = cp[i + 1], p3 = cp[Math.min(cp.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      pts.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  pts.push(cp[cp.length - 1].slice(0, 2)); return pts;
}

// ---------------------------------------------------------------- light
const LIGHT = norm3([-0.62, 0.55, 0.56]);   // from upper left front
const VIEW = norm3([0, 0.35, 0.94]);
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
const HALF = norm3([LIGHT[0] + VIEW[0], LIGHT[1] + VIEW[1], LIGHT[2] + VIEW[2]]);
// darkness from a normal: 0 = paper, 1 = black
function shadeN(n, o = {}) {
  const lam = Math.max(0, dot3(n, LIGHT));
  const spec = Math.pow(Math.max(0, dot3(n, HALF)), o.shine ?? 30);
  let d = 1 - (o.amb ?? 0.05) - lam * (o.diff ?? 1.0);
  d = smooth(o.lo ?? 0.05, o.hi ?? 0.8, d);
  // reflected light right at the dark silhouette
  const rim = Math.pow(clamp(1 - Math.abs(n[2]) * 1.15), 3) * (n[0] > 0 ? 1 : 0);
  d = clamp(d * (o.dark ?? 1) + (o.base ?? 0) - rim * (o.reflect ?? 0.28));
  if (spec > (o.specTh ?? 0.5)) d *= o.gloss ?? 0.05;
  return clamp(d);
}

// ---------------------------------------------------------------- surfaces of revolution
// prof: [[y, r], ...] control points from bottom (larger y) to top (smaller y), screen units.
// k: ellipse squash (view from above).
class Vessel {
  constructor(cx, prof, o = {}) {
    this.cx = cx; this.k = o.k ?? 0.3; this.o = o;
    const sm = catmull(prof.map(p => [p[0], p[1]]), o.seg ?? 10);
    this.prof = sm;                         // dense [y, r]
    this.n = sm.length;
  }
  yr(t) { const f = clamp(t) * (this.n - 1), i = Math.min(this.n - 2, Math.floor(f)), u = f - i; const a = this.prof[i], b = this.prof[i + 1]; return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; }
  pt(th, t) { const [y, r] = this.yr(t); return [this.cx + r * Math.sin(th), y + this.k * r * Math.cos(th)]; }
  normal(th, t) {
    const e = 0.004; const [y0, r0] = this.yr(t - e), [y1, r1] = this.yr(t + e);
    const dh = -(y1 - y0), dr = r1 - r0;           // height grows upward
    const n = [dh * Math.sin(th), -dr, dh * Math.cos(th)];
    if (dh < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
    return norm3(n);
  }
  silhouette() { // closed outline of the visible body (front + rim back)
    const L = [], Rt = [];
    for (let i = 0; i <= 120; i++) { const t = i / 120; L.push(this.pt(-Math.PI / 2, t)); Rt.push(this.pt(Math.PI / 2, t)); }
    const top = []; for (let i = 0; i <= 60; i++) { const a = -Math.PI / 2 - Math.PI * i / 60; top.push(this.pt(a, 1)); }
    const bot = []; for (let i = 0; i <= 60; i++) { const a = Math.PI / 2 - Math.PI * i / 60; bot.push(this.pt(a, 0)); }
    // left edge up, top back arc (left->right through the back), right edge down, bottom front arc
    return [...L, ...top, ...Rt.reverse(), ...bot];
  }
  path() { return polyPath(this.silhouette()); }
  frontPath() { // body below the front half of the rim (covers contents put inside)
    const fr = []; for (let i = 0; i <= 60; i++) fr.push(this.pt(-Math.PI / 2 + Math.PI * i / 60, 1));
    const Rt = []; for (let i = 120; i >= 0; i--) Rt.push(this.pt(Math.PI / 2, i / 120));
    const bot = []; for (let i = 0; i <= 60; i++) bot.push(this.pt(Math.PI / 2 - Math.PI * i / 60, 0));
    const L = []; for (let i = 0; i <= 120; i++) L.push(this.pt(-Math.PI / 2, i / 120));
    return polyPath([...fr, ...Rt, ...bot, ...L]);
  }
  // darkness on the surface
  dark(th, t) {
    const o = this.o; let d = shadeN(this.normal(th, t), o.shade ?? {});
    if (o.darkFn) d = o.darkFn(d, th, t);
    return d;
  }
  // engraved meridian lines (+ cross parallels in the deep shadow)
  rmax() { return Math.max(...this.prof.map(p => p[1])); }
  height() { return Math.abs(this.prof[0][0] - this.prof[this.n - 1][0]); }
  engrave(o = {}) {
    const tmin = o.t0 ?? 0, tmax = o.t1 ?? 1;
    const n = o.lines ?? Math.max(8, Math.round(this.rmax() * 2 / (o.sp ?? 2.3)));
    const path = o.clip ?? this.path();
    ctx.save(); ctx.clip(path);
    for (let i = 0; i < n; i++) {
      const u = -1 + (i + 0.5 + rr(-0.15, 0.15)) * 2 / n; const th = Math.asin(clamp(u, -0.999, 0.999));
      const pts = []; const K = 140; for (let k = 0; k <= K; k++) { const t = lerp(tmin, tmax, k / K); const p = this.pt(th, t); pts.push([p[0], p[1], th, t]); }
      hatchPolyline(pts, (x, y, p) => this.dark(p[2], p[3]), { th: o.th ?? 0.2, w: o.w ?? 1.15, nOff: i * 3.1, gain: o.gain ?? 1.6, wmax: 2.1 });
    }
    const m = o.rings ?? Math.max(4, Math.round(this.height() / (o.sp2 ?? 3.0)));
    for (let j = 0; j < m; j++) {
      const t = lerp(tmin, tmax, (j + 0.5 + rr(-0.2, 0.2)) / m);
      const pts = []; for (let k = 0; k <= 100; k++) { const th = -Math.PI / 2 + Math.PI * k / 100; const p = this.pt(th, t); pts.push([p[0], p[1], th, t]); }
      hatchPolyline(pts, (x, y, p) => this.dark(p[2], p[3]), { th: o.th2 ?? 0.5, w: (o.w ?? 1.15) * 0.85, nOff: j * 5.7, gain: 1.4 });
    }
    if (o.deep !== false) { // third layer, diagonal, in the core shadow
      const m3 = Math.round((this.height() + this.rmax()) / 2.4);
      for (let j = -m3; j < m3; j++) {
        const pts = []; for (let k = 0; k <= 100; k++) { const t = lerp(tmin, tmax, k / 100); const th = clamp(j / m3 * 2.2 + (t - 0.5) * 1.6, -1.55, 1.55); const p = this.pt(th, t); pts.push([p[0], p[1], th, t]); }
        hatchPolyline(pts, (x, y, p) => this.dark(p[2], p[3]), { th: o.th3 ?? 0.74, w: 0.9, nOff: j * 2.3, gain: 1.2 });
      }
    }
    ctx.restore();
  }
  outline(o = {}) {
    const w = o.w ?? 1.6;
    const L = [], Rt = [];
    for (let i = 0; i <= 100; i++) { const t = i / 100; L.push([...this.pt(-Math.PI / 2, t), 0.8]); Rt.push([...this.pt(Math.PI / 2, t), 1.25]); }
    contour(L, { w }); contour(Rt, { w });
    const bot = ellipsePts(0, 0, 1, 1, 0, Math.PI, 60).map((_, i) => { const a = Math.PI / 2 - Math.PI * i / 60; return [...this.pt(a, 0), 1 + 0.3 * Math.sin(a)]; });
    contour(bot, { w });
    if (o.rim !== false) {
      const rim = []; const full = o.rimBack !== false;
      for (let i = 0; i <= 120; i++) { const a = full ? Math.PI * 2 * i / 120 : -Math.PI / 2 + Math.PI * i / 120; rim.push(this.pt(a, 1)); }
      contour(rim, { w: w * (o.rimW ?? 0.9) });
    }
  }
  ring(t, o = {}) { // decorative band line at height t (front half)
    const pts = []; for (let k = 0; k <= 60; k++) { const th = -Math.PI / 2 + Math.PI * k / 60; pts.push([...this.pt(th, t), 0.8 + 0.4 * Math.sin(th)]); }
    line(pts, { w: o.w ?? 1, taper: 0.05, jit: 0.2 });
  }
}

// a tube (handle, spout) along a centreline; rad(s) = radius along s in [0,1]
function tube(center, rad, o = {}) {
  const C = resample(center, 0.8); const n = C.length;
  const L = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const r = rad(i / (n - 1)); L.push([C[i][0] - dy * r, C[i][1] + dx * r]); Rt.push([C[i][0] + dy * r, C[i][1] - dx * r]);
  }
  const shape = polyPath([...L, ...Rt.slice().reverse()]);
  if (o.erase !== false) erase(shape);
  // shading across the tube: light from upper left -> dark on the side whose normal points down/right
  ctx.save(); ctx.clip(shape);
  const step = o.step ?? 1.7;
  for (let i = 0; i < n; i += Math.max(1, Math.round(step / 0.8))) {
    const l = L[i], r = Rt[i];
    // side normal of 'r' side in screen space
    const nx = r[0] - C[i][0], ny = r[1] - C[i][1]; const nl = Math.hypot(nx, ny) || 1;
    const facing = (-(nx / nl) * LIGHT[0] + (ny / nl) * LIGHT[1]); // >0 : r side lit
    const darkSide = facing > 0 ? l : r;
    const frac = o.frac ?? 0.55;
    const s = [lerp(darkSide[0], C[i][0], 0), lerp(darkSide[1], C[i][1], 0)];
    const e = [lerp(darkSide[0], (facing > 0 ? r : l)[0], frac), lerp(darkSide[1], (facing > 0 ? r : l)[1], frac)];
    line([s, e], { w: o.hw ?? 0.8, taper: 0.5, jit: 0.15, taperStart: 0 });
  }
  ctx.restore();
  contour(L.map(p => [...p, 1]), { w: o.w ?? 1.3 }); contour(Rt.map(p => [...p, 1]), { w: o.w ?? 1.3 });
  if (o.capEnd) contour([L[n - 1], Rt[n - 1]], { w: o.w ?? 1.3, double: false });
  if (o.capStart) contour([L[0], Rt[0]], { w: o.w ?? 1.3, double: false });
  return shape;
}

// ---------------------------------------------------------------- little things
function bean(x, y, len, rot, o = {}) {
  const wdt = len * 0.66;
  const pts = ellipsePts(0, 0, len / 2, wdt / 2, 0, Math.PI * 2, 50).map(p => [p[0] * (1 + 0.06 * Math.sin(p[1])), p[1]]);
  const T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  const shp = pts.map(T); const path = polyPath(shp);
  erase(path);
  // shading: dark on the lower right
  const dfn = (px, py) => { const lx = (px - x), ly = (py - y); const d = (lx * 0.6 + ly * 0.8) / (len * 0.45); const hl = Math.hypot(lx + len * 0.18, ly + len * 0.16) / len; return clamp(0.58 + d * 0.5 + (o.dark ?? 0) - smooth(0, 0.25, 0.22 - hl) * 0.6); };
  hatchRegion(path, rot + 0.15, 1.25, dfn, { th: 0.25, w: 0.85, bbox: [x - len, y - len, x + len, y + len], wave: 0.2, gain: 1.5 });
  hatchRegion(path, rot + 1.3, 1.6, (a, b) => dfn(a, b) - 0.3, { th: 0.4, w: 0.7, bbox: [x - len, y - len, x + len, y + len] });
  contour(shp.map((p, i) => [...p, 1 + 0.5 * Math.sin(i / shp.length * 6.28 + 1)]), { w: o.w ?? 1.3, double: false });
  // the crease
  const cr = []; for (let i = 0; i <= 20; i++) { const t = -0.44 + 0.88 * i / 20; cr.push(T([t * len, Math.sin(t * 6.5) * wdt * 0.1])); }
  line(cr.map((p, i) => [...p, 1.6 - Math.abs(i - 10) / 11]), { w: 1.6, taper: 0.3 });
  // light edge beside the crease
  line(cr.map(p => [p[0] - Math.sin(rot) * 1.4, p[1] + Math.cos(rot) * 1.4]).map(p => T([0, 0]) && p).slice(3, 17).map(p => [...p, 0.5]), { w: 0.6, taper: 0.4, alpha: 0.6 });
}
function steam(x, y, h, o = {}) {
  for (let k = 0; k < (o.n ?? 3); k++) {
    const pts = []; const ph = R() * 6, amp = (o.amp ?? 6) * rr(0.7, 1.2), x0 = x + (k - 1) * (o.gap ?? 9);
    for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([x0 + Math.sin(ph + t * 5.5) * amp * (0.4 + t), y - t * h * rr(0.95, 1.05)]); }
    line(pts, { w: o.w ?? 1.1, taper: 0.45, alpha: 0.85, jit: 0.3 });
  }
}
