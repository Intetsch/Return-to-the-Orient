'use strict';
// profile helper: local [h(up), r] -> screen [y, r]
function V(cx, by, s, prof, o = {}) { return new Vessel(cx, prof.map(([h, r]) => [by - h * s, r * s]), o); }
function body(v, o = {}) { erase(v.path()); v.engrave(o.eng ?? {}); v.outline(o.out ?? {}); return v; }

// Liquid surface inside an open vessel at height t
function liquid(v, t, o = {}) {
  const [y, r0] = v.yr(t); const r = r0 * (o.rs ?? 0.985);
  const pts = ellipsePts(v.cx, y, r, r * v.k, 0, Math.PI * 2, 90);
  const path = polyPath(pts);
  erase(path);
  const bb = [v.cx - r, y - r * v.k, v.cx + r, y + r * v.k];
  const dfn = o.dfn ?? ((x, yy) => { const dx = (x - v.cx) / r, dy = (yy - y) / (r * v.k); const hl = Math.hypot(dx + 0.3, dy + 0.25); return clamp(1 - smooth(0.0, 0.5, 0.42 - hl) * 0.95 - smooth(0.7, 1.0, Math.hypot(dx, dy)) * 0.25); });
  hatchRegion(path, o.angle ?? 0.04, o.sp ?? 1.3, dfn, { th: 0.12, w: 0.95, bbox: bb, wave: 0.3, gain: 1.6 });
  if (o.cross !== false) hatchRegion(path, 1.25, 1.8, (x, yy) => dfn(x, yy) - 0.2, { th: 0.45, w: 0.8, bbox: bb });
  if (o.crema) { // bubbly ring of crema around the edge
    for (let i = 0; i < o.crema; i++) { const a = R() * Math.PI * 2, q = rr(0.72, 0.95); const bx = v.cx + Math.cos(a) * r * q, by2 = y + Math.sin(a) * r * v.k * q; const br = rr(0.8, 2.2); erase(polyPath(ellipsePts(bx, by2, br, br * 0.8, 0, 7, 12))); line(ellipsePts(bx, by2, br, br * 0.8, 0.5, 6.0, 12), { w: 0.6, taper: 0.3 }); }
  }
  contour(pts, { w: 0.9, double: false });
  return { path, y, r };
}
// shadow on the inside of the rim (back wall)
function innerWall(v, strength = 0.55, o = {}) {
  const [y1, r1] = v.yr(1);
  const rim = polyPath(ellipsePts(v.cx, y1, r1, r1 * v.k, 0, Math.PI * 2, 90));
  erase(rim);
  // concentric arcs following the inside of the vessel; dark on the left (inside faces away from the light)
  ctx.save(); ctx.clip(rim);
  const n = o.rings ?? Math.max(5, Math.round(r1 / 2.6));
  for (let i = 0; i < n; i++) {
    const q = 1 - (i + 0.5) / n * (o.depth ?? 0.9);
    const yc = y1 + (1 - q) * r1 * v.k * (o.drop ?? 1.6);
    const pts = []; for (let k = 0; k <= 120; k++) { const a = Math.PI * 2 * k / 120; pts.push([v.cx + Math.cos(a) * r1 * q, yc + Math.sin(a) * r1 * v.k * q, a, q]); }
    hatchPolyline(pts, (x, y, p) => { const u = Math.cos(p[2]); const back = Math.sin(p[2]) < 0 ? 1 : 0.55; return clamp(strength * (0.75 - 0.6 * u) * back * (0.55 + 0.45 * p[3])); }, { th: 0.18, w: 0.8, nOff: i * 4.2, gain: 1.4 });
  }
  ctx.restore();
}
function castShadow(cx, cy, rx, ry, o = {}) {
  const path = polyPath(ellipsePts(cx, cy, rx, ry, 0, Math.PI * 2, 60));
  hatchRegion(path, o.angle ?? -0.3, o.sp ?? 1.9, (x, y) => { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); return clamp((o.k ?? 0.95) - d * 0.95); }, { th: 0.1, w: 0.8, bbox: [cx - rx, cy - ry, cx + rx, cy + ry], wave: 0.4 });
}
function dotsBand(v, t, n, o = {}) { // little ornament dots / beads around a band (front half)
  for (let i = 0; i < n; i++) { const th = -Math.PI / 2 + Math.PI * (i + 0.5) / n; if (Math.abs(th) > 1.45) continue; const [x, y] = v.pt(th, t); const r = (o.r ?? 1.3) * (0.6 + 0.4 * Math.cos(th)); ctx.beginPath(); ctx.ellipse(x, y, r * Math.cos(th) + 0.4, r, 0, 0, 7); ctx.fill(); }
}
function zigBand(v, t0, t1, n, o = {}) { // engraved zig-zag / arch band
  const pts = [];
  for (let i = 0; i <= n * 2; i++) { const th = -Math.PI / 2 + Math.PI * i / (n * 2); const t = i % 2 ? t1 : t0; const p = v.pt(th, t); pts.push([...p, 0.6 + 0.5 * Math.max(0, Math.sin(th))]); }
  line(pts, { w: o.w ?? 0.9, taper: 0.05, jit: 0.15, step: 0.8 });
}
function archBand(v, t0, t1, n) { // row of little pointed arches
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + Math.PI * i / n, a1 = -Math.PI / 2 + Math.PI * (i + 1) / n; if (Math.abs((a0 + a1) / 2) > 1.35) continue;
    const pts = []; for (let k = 0; k <= 16; k++) { const f = k / 16; const th = lerp(a0, a1, f); const t = t0 + (t1 - t0) * Math.pow(Math.sin(f * Math.PI), 0.7); pts.push([...v.pt(th, t), 0.7 + 0.4 * Math.max(0, Math.sin(th))]); }
    line(pts, { w: 0.85, taper: 0.1, jit: 0.1 });
  }
}

// ---------------------------------------------------------------- objects
function cezve(cx, by, s = 1, o = {}) {
  const v = V(cx, by, s, [[0, 36], [3, 41], [14, 44], [34, 41], [52, 33], [64, 28], [72, 30], [78, 35]], { k: 0.3, shade: { shine: 40 } });
  const [yN, rN] = v.yr(0.78);
  const hl = o.handle ?? 1;
  tube([[cx - rN * 0.85, yN + 2 * s], [cx - rN - 30 * hl * s, yN - 10 * hl * s], [cx - rN - 70 * hl * s, yN - 26 * hl * s], [cx - rN - 100 * hl * s, yN - 38 * hl * s]], q => lerp(5.2, 4.0, q) * s, { capEnd: true });
  body(v, { out: { w: 2.0 } });
  // hammered copper
  stipple(v.path(), 900 * s, (x, y) => { const u = (x - cx) / (44 * s); return 0.25 + u * 0.3; }, { bbox: [cx - 45 * s, by - 80 * s, cx + 45 * s, by + 5], r: 0.5, alpha: 0.7 });
  v.ring(0.8); v.ring(0.84); archBand(v, 0.3, 0.45, 9); v.ring(0.28, { w: 0.9 });
  innerWall(v, 0.6); liquid(v, 0.9, { crema: 18 });
  return v;
}
function saucer(cx, by, s = 1, o = {}) {
  const v = V(cx, by, s, [[0, 30], [2, 40], [5, 53], [8, 62], [9.5, 64]], { k: o.k ?? 0.3, shade: { shine: 60 } });
  body(v, { eng: { th: 0.3, deep: false }, out: { w: 1.6, rimW: 1.0 } });
  // the top surface inside the rim
  const [y1, r1] = v.yr(1); const rim = polyPath(ellipsePts(cx, y1, r1, r1 * v.k, 0, Math.PI * 2, 90)); erase(rim);
  hatchRegion(rim, 0.05, 1.8, (x, y) => { const u = (x - cx) / r1, w = (y - y1) / (r1 * v.k); return clamp(0.42 - u * 0.25 - w * 0.25 - smooth(0, 0.6, 0.62 - Math.hypot(u, w))); }, { th: 0.28, w: 0.75, bbox: [cx - r1, y1 - r1, cx + r1, y1 + r1] });
  contour(ellipsePts(cx, y1, r1, r1 * v.k), { w: 1.4 });
  contour(ellipsePts(cx, y1 + 1.5 * s, r1 * 0.94, r1 * v.k * 0.92, 0.2, Math.PI - 0.2, 40), { w: 0.8, double: false });
  if (o.band) contour(ellipsePts(cx, y1 + 0.5 * s, r1 * 0.8, r1 * v.k * 0.78), { w: 0.7, double: false });
  return v;
}
function fincan(cx, by, s = 1, o = {}) {
  if (o.saucer !== false) {
    saucer(cx, by + 3 * s, s * (o.saucerS ?? 1), { band: true });
    castShadow(cx + 16 * s, by - 2 * s, 30 * s, 8 * s, { k: 0.8 });
  }
  const v = V(cx, by, s, [[0, 15], [2, 18], [10, 24], [26, 30], [38, 33], [42, 34]], { k: 0.3, shade: { shine: 55 } });
  const [y1] = v.yr(0.86), [y2] = v.yr(0.32), [, r1] = v.yr(0.86), [, r2] = v.yr(0.32);
  if (o.handle !== false) tube(bez([cx + r1 - 2 * s, y1], [cx + r1 + 26 * s, y1 - 5 * s], [cx + r2 + 26 * s, y2 + 6 * s], [cx + r2 - 2 * s, y2], 50), q => (3.4 - 0.9 * Math.sin(q * Math.PI)) * s, {});
  body(v, { out: { w: 1.9 } });
  v.ring(0.12, { w: 0.8 }); v.ring(0.78); v.ring(0.83);
  if (o.deco !== false) archBand(v, 0.55, 0.74, 8);
  innerWall(v, 0.6);
  const lq = liquid(v, 0.9, { crema: o.crema ?? 14, ...(o.liq ?? {}) });
  return { v, lq };
}
function finjan(cx, by, s = 1, o = {}) { // handleless arabic cup
  const v = V(cx, by, s, [[0, 11], [2, 13], [4, 12], [10, 16], [20, 21], [27, 23], [29, 23.5]], { k: 0.32, shade: { shine: 50 } });
  body(v, { out: { w: 1.7 } });
  v.ring(0.18, { w: 0.8 }); zigBand(v, 0.62, 0.8, 9); v.ring(0.84, { w: 0.9 });
  innerWall(v, 0.6);
  if (o.empty) return { v };
  const lq = liquid(v, 0.86, { crema: 8, ...(o.liq ?? {}) });
  return { v, lq };
}
function dallah(cx, by, s = 1) {
  const bodyV = V(cx, by, s, [[0, 30], [3, 33], [6, 31], [9, 29], [18, 38], [32, 44], [46, 40], [58, 29], [67, 20], [75, 18], [85, 23], [95, 29], [100, 31]], { k: 0.3, shade: { shine: 45 } });
  // handle (behind, right)
  const [yA, rA] = bodyV.yr(0.86), [yB, rB] = bodyV.yr(0.35);
  tube([[cx + rA - 3 * s, yA], [cx + rA + 22 * s, yA - 6 * s], [cx + rA + 32 * s, yA + 14 * s], [cx + rA + 28 * s, yA + 40 * s], [cx + rB + 14 * s, yB - 4 * s], [cx + rB - 4 * s, yB + 2 * s]], q => (3.6 - 0.8 * Math.sin(q * Math.PI)) * s, {});
  // decorative curl on the handle
  line(ellipsePts(cx + rA + 30 * s, yA + 4 * s, 5 * s, 5 * s, -1, 4.2, 30).map(p => [...p, 1]), { w: 1.3, taper: 0.2 });
  body(bodyV, { out: { w: 2.1 } });
  bodyV.ring(0.07); dotsBand(bodyV, 0.06, 22, { r: 1.1 }); bodyV.ring(0.62, { w: 0.9 }); bodyV.ring(0.66, { w: 0.9 }); zigBand(bodyV, 0.4, 0.55, 10);
  bodyV.ring(0.92); archBand(bodyV, 0.74, 0.9, 7);
  // spout: long beak on the left
  const [yS, rS] = bodyV.yr(0.42);
  const sp = [[cx - rS + 6 * s, yS + 4 * s], [cx - rS - 12 * s, yS - 12 * s], [cx - rS - 24 * s, yS - 34 * s], [cx - rS - 32 * s, yS - 62 * s], [cx - rS - 40 * s, yS - 82 * s]];
  const spP = catmull(sp, 12);
  const tip = spP[spP.length - 1];
  // beak (crescent) at the tip
  const beak = [[tip[0] + 7 * s, tip[1] + 2 * s], [tip[0] - 6 * s, tip[1] - 9 * s], [tip[0] - 22 * s, tip[1] - 10 * s], [tip[0] - 30 * s, tip[1] - 2 * s], [tip[0] - 20 * s, tip[1] - 3 * s], [tip[0] - 7 * s, tip[1] + 4 * s]];
  const beakP = catmull(beak, 8); const bp = polyPath(beakP); erase(bp);
  hatchRegion(bp, 0.5, 1.4, (x, y) => clamp(0.3 + (y - tip[1] + 6 * s) / (14 * s) * 0.6), { th: 0.25, bbox: [tip[0] - 32 * s, tip[1] - 14 * s, tip[0] + 10 * s, tip[1] + 8 * s] });
  contour(beakP.map(p => [...p, 1]), { w: 1.5 });
  tube(spP, q => lerp(8.5, 3.6, Math.pow(q, 0.8)) * s, { step: 1.4 });
  // lid + finial
  const lid = V(cx, bodyV.yr(1)[0] + 1 * s, s, [[0, 27], [3, 26], [8, 22], [14, 15], [18, 10], [20, 8]], { k: 0.3, shade: { shine: 40 } });
  body(lid, { out: { w: 1.7, rim: false } }); dotsBand(lid, 0.12, 16, { r: 0.9 });
  const fin = V(cx, lid.yr(1)[0] + 1 * s, s, [[0, 8], [3, 6], [6, 7.5], [9, 5], [14, 3.5], [24, 2], [36, 0.6]], { k: 0.3, shade: { shine: 30 } });
  body(fin, { out: { w: 1.4, rim: false }, eng: { deep: false } });
  // tiny crescent on top
  const ct = fin.yr(1); line(ellipsePts(cx, ct[0] - 6 * s, 5 * s, 5 * s, 0.6, 5.0, 24).map(p => [...p, 1.2]), { w: 1.6 * s, taper: 0.4 });
  return bodyV;
}
function milkJug(cx, by, s = 1) {
  const v = V(cx, by, s, [[0, 26], [3, 29], [16, 37], [32, 37], [48, 29], [58, 21], [66, 17], [74, 18], [80, 21]], { k: 0.3, shade: { shine: 25, base: 0.05 } });
  const [yA, rA] = v.yr(0.9), [yB, rB] = v.yr(0.45);
  tube(bez([cx + rA - 2 * s, yA + 2 * s], [cx + rA + 30 * s, yA - 8 * s], [cx + rB + 26 * s, yB + 2 * s], [cx + rB - 3 * s, yB + 6 * s], 50), q => (4.4 - 1.2 * Math.sin(q * Math.PI)) * s, {});
  body(v, { out: { w: 2.0 } });
  // clay texture
  stipple(v.path(), 1400 * s, (x, y) => 0.18 + (x - cx) / (40 * s) * 0.3, { bbox: [cx - 40 * s, by - 82 * s, cx + 40 * s, by + 5], r: 0.45, alpha: 0.6 });
  v.ring(0.55, { w: 0.9 }); zigBand(v, 0.42, 0.52, 11, { w: 0.8 }); v.ring(0.4, { w: 0.9 });
  innerWall(v, 0.5);
  // milk surface, light
  const lq = liquid(v, 0.93, { dfn: (x, y) => clamp(0.25 - (x - cx) / (30 * s) * 0.2), cross: false, sp: 2.2 });
  // pouring lip on the left
  const [y1, r1] = v.yr(1);
  const lip = [[cx - r1 + 4 * s, y1 - 3 * s], [cx - r1 - 6 * s, y1 - 6 * s], [cx - r1 - 9 * s, y1 - 3 * s], [cx - r1 - 2 * s, y1 + 4 * s]];
  const lp = catmull(lip, 8); erase(polyPath([...lp, [cx - r1 + 6 * s, y1 + 3 * s]])); contour(lp.map(p => [...p, 1]), { w: 1.5 });
  // milk drip
  line(catmull([[cx - r1 - 6 * s, y1 - 1 * s], [cx - r1 - 7 * s, y1 + 6 * s], [cx - r1 - 6 * s, y1 + 10 * s]], 8).map(p => [...p, 1]), { w: 1.0, taper: 0.4 });
  return v;
}
function glassCup(cx, by, s = 1, o = {}) { // tall glass with layered milk coffee
  const outer = V(cx, by, s, [[0, 23], [3, 25], [8, 24], [30, 25], [60, 28], [88, 31], [92, 31.5]], { k: 0.3 });
  const inner = V(cx, by, s, [[8, 21], [30, 23], [60, 26], [84, 29]], { k: 0.3 });
  erase(outer.path());
  const levels = o.levels ?? [0.0, 0.42, 0.6, 1.0]; // coffee | milk mix | foam
  // liquid body clipped in inner
  ctx.save(); ctx.clip(inner.path());
  // coffee layer (dark), mixing layer (mid), foam (light) - engrave with custom darkness
  inner.o.darkFn = (d, th, t) => {
    let base = t < levels[1] ? 0.88 : (t < levels[2] ? lerp(0.88, 0.3, smooth(levels[1], levels[2], t)) : 0.18);
    const side = (Math.sin(th) + 1) / 2; // 0 left .. 1 right
    let dd = base * (0.55 + 0.6 * side);
    if (th < -0.9 && th > -1.25) dd *= 0.1;  // glass highlight strip
    return clamp(dd);
  };
  inner.engrave({ th: 0.12, sp: 1.9, sp2: 2.5, th2: 0.55, deep: true, th3: 0.7 });
  ctx.restore();
  // foam bubbles at the top layer
  const [yf] = inner.yr(levels[2] + 0.05);
  for (let i = 0; i < 40; i++) { const th = rr(-1.4, 1.4); const t = rr(levels[2] + 0.04, 0.97); const [x, y] = inner.pt(th, t); const br = rr(0.6, 1.6) * s; line(ellipsePts(x, y, br, br * 0.85, 0.6, 5.6, 10), { w: 0.55, taper: 0.3 }); }
  // foam surface on top
  const [yt, rt] = inner.yr(1);
  const top = polyPath(ellipsePts(cx, yt, rt, rt * 0.3, 0, 7, 80)); erase(top);
  stipple(top, 1200 * s, (x, y) => clamp(0.15 + (x - cx) / rt * 0.25 + (y - yt) / (rt * 0.3) * 0.1), { bbox: [cx - rt, yt - rt * 0.3, cx + rt, yt + rt * 0.3], r: 0.45 });
  // a little cocoa/cinnamon dusting heart
  for (let i = 0; i < 60; i++) { const a = R() * 6.28, q = Math.sqrt(R()) * 0.35; const x = cx - 4 * s + Math.cos(a) * rt * q, y = yt + Math.sin(a) * rt * 0.3 * q; ctx.beginPath(); ctx.arc(x, y, 0.5, 0, 7); ctx.fill(); }
  contour(ellipsePts(cx, yt, rt, rt * 0.3), { w: 0.8, double: false });
  // glass contours (thin, broken) + highlights
  const L = [], Rr = []; for (let i = 0; i <= 80; i++) { const t = i / 80; L.push([...outer.pt(-Math.PI / 2, t), 0.8]); Rr.push([...outer.pt(Math.PI / 2, t), 1.2]); }
  contour(L, { w: 1.4 }); contour(Rr, { w: 1.6 });
  contour(ellipsePts(0, 0, 1, 1, 0, Math.PI, 40).map((_, i) => [...outer.pt(Math.PI / 2 - Math.PI * i / 40, 0), 1.1]), { w: 1.5 });
  contour(ellipsePts(cx, outer.yr(1)[0], outer.yr(1)[1], outer.yr(1)[1] * 0.3), { w: 1.2 });
  // thick glass base
  const [yb, rb] = outer.yr(0.08); contour(ellipsePts(cx, yb, rb, rb * 0.3, 0.1, Math.PI - 0.1, 40), { w: 1.0 });
  hatchRegion(outer.path(), 0.0, 1.6, (x, y) => (y > yb - 2 && y < by + 6 && x > cx) ? 0.55 : 0, { th: 0.2, bbox: [cx - 30 * s, yb - 10 * s, cx + 30 * s, by + 10] });
  // vertical highlight lines on the glass
  for (const th of [-1.05, -0.95, 1.2]) { const pts = []; for (let k = 10; k <= 85; k++) pts.push(outer.pt(th, k / 100)); line(pts, { w: 0.6, taper: 0.4, alpha: 0.6 }); }
  return outer;
}
function gulabdan(cx, by, s = 1) { // rose water sprinkler
  const v = V(cx, by, s, [[0, 19], [2, 21], [5, 18], [9, 15], [14, 21], [24, 29], [36, 31], [48, 26], [56, 17], [61, 9], [66, 6], [82, 4.5], [100, 4], [106, 5.5], [111, 7], [115, 5], [120, 3], [128, 1.5], [134, 0.5]], { k: 0.3, shade: { shine: 60 } });
  body(v, { out: { w: 1.8, rim: false } });
  v.ring(0.04); dotsBand(v, 0.12, 18, { r: 1 }); v.ring(0.27); archBand(v, 0.3, 0.42, 8); v.ring(0.44); zigBand(v, 0.46, 0.52, 10); v.ring(0.54);
  v.ring(0.6); v.ring(0.62); v.ring(0.8, { w: 0.8 }); v.ring(0.84, { w: 0.8 });
  // engraved flower on the belly
  const [fx, fy] = v.pt(-0.15, 0.36);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(ellipsePts(fx + Math.cos(a) * 4 * s, fy + Math.sin(a) * 3 * s, 3 * s, 1.6 * s, 0, 7, 16, a), { w: 0.6, taper: 0.1 }); }
  return v;
}
function honeyPot(cx, by, s = 1, o = {}) {
  const v = V(cx, by, s, [[0, 24], [3, 28], [16, 37], [34, 38], [48, 32], [54, 27], [58, 27], [62, 29]], { k: 0.3, shade: { shine: 30 } });
  body(v, { out: { w: 2.0 } });
  stipple(v.path(), 1200 * s, (x, y) => 0.15 + (x - cx) / (40 * s) * 0.3, { bbox: [cx - 40 * s, by - 64 * s, cx + 40 * s, by + 5], r: 0.45, alpha: 0.6 });
  v.ring(0.82); v.ring(0.86, { w: 0.8 }); archBand(v, 0.55, 0.72, 9);
  innerWall(v, 0.6);
  const lq = liquid(v, 0.9, { dfn: (x, y) => { const u = (x - cx) / (28 * s); return clamp(0.55 + u * 0.35 - (Math.abs(u + 0.35) < 0.12 ? 0.5 : 0)); }, cross: false, sp: 1.5 });
  if (o.dipper) dipperIn(v, ...o.dipper, s);
  // honey drips over the rim
  const [y1, r1] = v.yr(1);
  for (const [th, len] of [[-0.6, 16], [0.25, 26], [0.75, 11]]) {
    const [x0, y0] = v.pt(th, 1); const w0 = 3.2 * s;
    const pts = []; for (let i = 0; i <= 20; i++) { const f = i / 20; pts.push([x0 + Math.sin(f * 2) * 0.8, y0 + f * len * s]); }
    const L = pts.map((p, i) => [p[0] - w0 * (1 - 0.5 * i / 20), p[1]]), Rr = pts.map((p, i) => [p[0] + w0 * (1 - 0.5 * i / 20), p[1]]);
    const end = pts[pts.length - 1];
    const shape = [...L, ...ellipsePts(end[0], end[1], w0 * 0.75, w0 * 0.85, Math.PI, 0, 12).reverse().map(p => [p[0], p[1] + 0]).reverse(), ...Rr.reverse()];
    const sp = polyPath(shape); erase(sp);
    hatchRegion(sp, 1.57, 1.1, (x, y) => (x > end[0] - 0.5) ? 0.75 : 0.25, { th: 0.2, w: 0.7, bbox: [x0 - 8, y0 - 2, x0 + 8, y0 + len * s + 8] });
    contour(shape.map(p => [...p, 0.9]), { w: 1.1, double: false });
  }
  return v;
}
function dipper(x0, y0, x1, y1, s = 1) { // honey dipper from handle end (x0,y0) to head (x1,y1)
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  // handle
  tube([[x0, y0], [x0 + dx * 0.62, y0 + dy * 0.62]], q => (2.4 + q * 0.6) * s, { capStart: true });
  // grooved barrel head
  const f0 = 0.6, nx = -uy, ny = ux, N = 80, ridges = 5;
  const wd = f => { const g = (f - f0) / (1 - f0); const env = Math.pow(Math.sin(Math.PI * clamp(g * 0.92 + 0.04)), 0.45); return (6 + 4.5 * env * (0.72 + 0.28 * Math.abs(Math.cos(g * Math.PI * ridges)))) * s; };
  const A = [], B = [];
  for (let i = 0; i <= N; i++) { const f = f0 + (1 - f0) * i / N; const px = x0 + dx * f, py = y0 + dy * f, w = wd(f); A.push([px + nx * w, py + ny * w]); B.push([px - nx * w, py - ny * w]); }
  const hp = polyPath([...A, ...B.slice().reverse()]); erase(hp);
  const lightSide = (nx * LIGHT[0] - ny * LIGHT[1]) > 0 ? 1 : -1; // which side faces the light
  hatchRegion(hp, Math.atan2(uy, ux) + 1.57, 1.2, (x, y) => { const f = ((x - x0) * ux + (y - y0) * uy) / L; const side = ((x - x0) * nx + (y - y0) * ny) / wd(clamp(f, f0, 1)); const groove = Math.abs(Math.cos(((f - f0) / (1 - f0)) * Math.PI * ridges)) < 0.35 ? 0.35 : 0; return clamp(0.32 - side * lightSide * 0.42 + groove); }, { th: 0.2, w: 0.85, bbox: [Math.min(x0, x1) - 15, Math.min(y0, y1) - 15, Math.max(x0, x1) + 15, Math.max(y0, y1) + 15], gain: 1.5 });
  // groove rings
  for (let k = 1; k < ridges; k++) { const f = f0 + (1 - f0) * (k + 0.5) / ridges; const px = x0 + dx * f, py = y0 + dy * f, w = wd(f) * 0.96; line(bez([px + nx * w, py + ny * w], [px + nx * w * 0.4 + ux * 2.2 * s, py + ny * w * 0.4 + uy * 2.2 * s], [px - nx * w * 0.4 + ux * 2.2 * s, py - ny * w * 0.4 + uy * 2.2 * s], [px - nx * w, py - ny * w], 16).map(p => [...p, 1]), { w: 1.1, taper: 0.15 }); }
  contour(A.map(p => [...p, 1]), { w: 1.3 }); contour(B.map(p => [...p, 1]), { w: 1.3 });
  const tipC = [x0 + dx, y0 + dy]; contour(ellipsePts(tipC[0], tipC[1], 2.5 * s, wd(1) * 0.9, -Math.PI / 2, Math.PI / 2, 20, Math.atan2(uy, ux)).map(p => [...p, 1]), { w: 1.2, double: false });
  return { head: [x0 + dx * 0.82, y0 + dy * 0.82], w: wd(0.82) };
}
function bowl(cx, by, s = 1, o = {}) {
  const v = V(cx, by, s, o.prof ?? [[0, 18], [2, 22], [4, 21], [10, 31], [18, 41], [25, 47], [28, 48]], { k: o.k ?? 0.34, shade: { shine: 40 } });
  const deco = () => { if (o.deco !== false) { v.ring(0.12, { w: 0.8 }); archBand(v, 0.4, 0.74, 10); v.ring(0.82, { w: 0.9 }); } };
  body(v, { out: { w: 1.8 } }); deco();
  innerWall(v, 0.5);
  if (o.fill) {
    o.fill(v);
    // bring the front of the bowl back over the contents
    const fp = v.frontPath(); erase(fp); v.engrave({ clip: fp }); v.outline({ w: 1.8, rimBack: false }); deco();
  }
  return v;
}
function rosebud(x, y, S, rot = 0, o = {}) { // (x,y) = base of the bud, bud points 'up' along rot
  const T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  if (o.stem !== false) {
    const st = [[0, S * 0.1], [S * 0.12, S * 0.8], [-S * 0.08, S * 1.6], [S * 0.1, S * (o.stemLen ?? 2.4)]].map(T);
    tube(catmull(st, 10), q => S * 0.07 * (1 - 0.2 * q), { capEnd: true, step: 1.2 });
    // thorns
    const sp = catmull(st, 10);
    for (const f of [0.35, 0.65]) { const p = sp[Math.round(f * 30)]; line([[p[0] + S * 0.06, p[1]], [p[0] + S * 0.2, p[1] - S * 0.08]], { w: 1.0, taper: 0.9, taperStart: 0 }); }
    for (const [f, side] of [[0.45, 1], [0.78, -1]]) { const p = sp[Math.round(f * 30)]; leaf(p[0], p[1], S * 1.25, rot - Math.PI / 2 + side * 0.9 + Math.PI, { serrate: true, w: 0.45, dark: 0.4 }); }
  }
  // bud body
  const budL = catmull([[0, 0], [-0.46, -0.2], [-0.58, -0.62], [-0.38, -1.05], [0.02, -1.38], [0.36, -1.12], [0.56, -0.68], [0.44, -0.22], [0, 0]].map(p => [p[0] * S, p[1] * S]), 10);
  const shp = budL.map(T); const bp = polyPath(shp); erase(bp);
  const dfn = (px, py) => { const lx = (px - x) * Math.cos(-rot) - (py - y) * Math.sin(-rot), ly = (px - x) * Math.sin(-rot) + (py - y) * Math.cos(-rot); return clamp(0.3 + lx / S * 0.6 + (ly / S + 0.7) * 0.25); };
  hatchRegion(bp, rot + 1.25, 1.3, dfn, { th: 0.25, w: 0.8, bbox: [x - 2 * S, y - 2 * S, x + 2 * S, y + 2 * S], bend: t => -t * t * 6 });
  contour(shp.map((p, i) => [...p, 1 + 0.4 * Math.sin(i / shp.length * 6.28)]), { w: 1.5 });
  // wrapped petal edges
  const wraps = [[[-0.56, -0.55], [-0.15, -0.72], [0.28, -0.98], [0.1, -1.33]], [[0.52, -0.3], [0.1, -0.52], [-0.32, -0.86], [-0.24, -1.18]], [[-0.3, -1.0], [-0.05, -1.12], [0.12, -1.2], [0.2, -1.1]]];
  wraps.forEach((wp, i) => {
    const pts = catmull(wp.map(p => [p[0] * S, p[1] * S]), 12).map(T);
    // shade under each wrap edge
    const shadow = pts.map(p => [p[0] + Math.sin(rot) * 0, p[1]]);
    line(pts.map((p, j) => [...p, 1.2 - j / pts.length * 0.5]), { w: 1.3, taper: 0.25 });
    for (let j = 2; j < pts.length - 2; j += 2) line([pts[j], [pts[j][0] + 2.5, pts[j][1] + 3.5]], { w: 0.6, taper: 0.6, taperStart: 0 });
  });
  // sepals
  const sep = [[-0.9, 0.55], [0.85, 0.4], [-0.35, 0.9], [0.4, 0.95]];
  for (const [dx, curl] of sep) {
    const pts = catmull([[0, 0], [dx * S * 0.4, -S * 0.2], [dx * S * 0.75, S * 0.05 * curl], [dx * S * 0.95, S * 0.45 * curl]], 10).map(T);
    const ww = S * 0.09;
    const L = [], Rr = []; for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx2 = b[0] - a[0], dy2 = b[1] - a[1], dl = Math.hypot(dx2, dy2) || 1; const w2 = ww * Math.sin((1 - i / (pts.length - 1)) * Math.PI * 0.5 + 0.2); L.push([pts[i][0] - dy2 / dl * w2, pts[i][1] + dx2 / dl * w2]); Rr.push([pts[i][0] + dy2 / dl * w2, pts[i][1] - dx2 / dl * w2]); }
    const sp = polyPath([...L, ...Rr.reverse()]); erase(sp);
    hatchRegion(sp, rot + dx, 1.1, () => 0.6, { th: 0.2, w: 0.7, bbox: [x - 2 * S, y - 2 * S, x + 2 * S, y + 2 * S] });
    contour([...L, ...Rr].map(p => [...p, 0.9]), { w: 0.9, double: false });
  }
}
function roseBloom(x, y, S, rot = 0, o = {}) { // three-quarter view rose head built from petals, (x,y) = bloom centre
  const T = p => [x + (p[0] * Math.cos(rot) - p[1] * Math.sin(rot)) * S, y + (p[0] * Math.sin(rot) + p[1] * Math.cos(rot)) * S];
  const inv = (px, py) => { const dx = (px - x) / S, dy = (py - y) / S; return [dx * Math.cos(-rot) - dy * Math.sin(-rot), dx * Math.sin(-rot) + dy * Math.cos(-rot)]; };
  const bb = [x - S * 1.4, y - S * 1.4, x + S * 1.4, y + S * 1.4];
  const pet = (cp0, base, lip, dk = 0) => {
    const cp = cp0.map(p => [p[0] + rr(-0.035, 0.035), p[1] + rr(-0.035, 0.035)]);
    const loc = catmull([...cp, cp[0]], 8); const shp = loc.map(T); const pp = polyPath(shp); erase(pp);
    hatchRegion(pp, rot + (o.ang ?? 1.0) + base[0] * 0.8, 1.25, (px, py) => { const [lx, ly] = inv(px, py); const d = Math.hypot(lx - base[0], ly - base[1]); return clamp(0.85 - d * 1.25 + lx * 0.12 + dk + (o.dark ?? 0)); }, { th: 0.25, w: 0.8, bbox: bb, bend: t => t * t * 5, gain: 1.5 });
    contour(shp.map((p, i) => [...p, 0.9 + 0.4 * Math.sin(i / shp.length * 6.28)]), { w: 1.25 });
    if (lip) line(catmull(lip, 10).map(T).map(p => [...p, 0.8]), { w: 0.85, taper: 0.3 });
  };
  // back petals
  pet([[-0.15, -0.1], [-0.55, -0.32], [-0.9, -0.5], [-0.78, -0.8], [-0.4, -0.86], [-0.08, -0.62], [0.0, -0.3]], [-0.1, -0.2], [[-0.82, -0.62], [-0.6, -0.76], [-0.3, -0.76]], 0.05);
  pet([[0.15, -0.1], [0.55, -0.34], [0.92, -0.48], [0.8, -0.78], [0.42, -0.88], [0.1, -0.64], [0.0, -0.3]], [0.1, -0.2], [[0.84, -0.6], [0.62, -0.76], [0.32, -0.78]], 0.12);
  pet([[-0.32, -0.32], [-0.38, -0.72], [0.0, -0.92], [0.38, -0.72], [0.32, -0.32], [0, -0.26]], [0, -0.3], [[-0.3, -0.72], [0, -0.84], [0.3, -0.72]], 0.08);
  // the bud in the middle
  const bud = ellipsePts(0, -0.44, 0.3, 0.17, 0, 7, 40).map(p => [p[0], p[1]]);
  const bp = polyPath(bud.map(T)); erase(bp);
  hatchRegion(bp, rot + 0.4, 1.2, (px, py) => { const [lx, ly] = inv(px, py); return clamp(0.55 + lx * 0.6 - (ly + 0.44) * 1.2); }, { th: 0.3, w: 0.7, bbox: bb });
  contour(bud.map(T).map(p => [...p, 1]), { w: 1.1, double: false });
  const sp = []; for (let i = 0; i <= 80; i++) { const f = i / 80, a = 0.5 + f * Math.PI * 4.2, r = 0.25 * (1 - f * 0.85); sp.push([Math.cos(a) * r, -0.44 + Math.sin(a) * r * 0.55]); }
  line(sp.map(T).map((p, i) => [...p, 1.1 - i / 160]), { w: 1.1, taper: 0.1 });
  // inner wrapping petals
  pet([[-0.44, -0.46], [-0.52, -0.14], [-0.3, 0.14], [0.05, 0.2], [0.24, 0.02], [0.02, -0.24], [-0.22, -0.44]], [-0.05, 0.05], [[-0.46, -0.36], [-0.28, -0.32], [-0.12, -0.38]], 0.05);
  pet([[0.44, -0.5], [0.54, -0.2], [0.4, 0.1], [0.1, 0.18], [-0.04, 0.02], [0.12, -0.3], [0.3, -0.48]], [0.08, 0.05], [[0.46, -0.42], [0.36, -0.3], [0.2, -0.36]], 0.15);
  // front outer petals
  pet([[-0.05, 0.22], [-0.5, 0.16], [-0.92, -0.05], [-1.02, 0.26], [-0.78, 0.56], [-0.36, 0.64], [0.0, 0.46]], [-0.1, 0.3], [[-0.95, 0.02], [-0.7, 0.04], [-0.42, 0.16]], 0.0);
  pet([[0.05, 0.22], [0.5, 0.12], [0.96, -0.02], [1.04, 0.28], [0.8, 0.56], [0.36, 0.66], [0.0, 0.46]], [0.1, 0.3], [[0.98, 0.04], [0.72, 0.03], [0.44, 0.13]], 0.1);
  pet([[-0.46, 0.36], [-0.32, 0.68], [0.0, 0.78], [0.32, 0.68], [0.46, 0.36], [0.0, 0.42]], [0, 0.45], [[-0.36, 0.44], [0, 0.5], [0.36, 0.44]], 0.0);
}
function dipperIn(v, th, t, ang, len, s = 1) { // honey dipper handle sticking out of a vessel's honey at (th,t)
  const [x0, y0] = v.pt(th, t);
  const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
  tube([[x0, y0], [x1, y1]], q => (3.2 - q * 0.9) * s, { capEnd: true });
  // knob at the end
  const kp = polyPath(ellipsePts(x1, y1, 3.6 * s, 3.6 * s, 0, 7, 20)); erase(kp); hatchRegion(kp, 0.8, 1.1, (a, b) => clamp(0.3 + (a - x1) / 4 * 0.4 + (b - y1) / 4 * 0.3), { th: 0.2, bbox: [x1 - 5, y1 - 5, x1 + 5, y1 + 5] }); contour(ellipsePts(x1, y1, 3.6 * s, 3.6 * s).map(p => [...p, 1]), { w: 1.1, double: false });
  // honey collar where it enters
  const cp = polyPath(ellipsePts(x0, y0, 6 * s, 2.4 * s, 0, 7, 24)); erase(cp); contour(ellipsePts(x0, y0, 6 * s, 2.4 * s, 0, Math.PI, 20).map(p => [...p, 1]), { w: 1.0, double: false });
}
function dateFruit(x, y, len, rot, o = {}) {
  const wdt = len * (o.fat ?? 0.56);
  const T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  const bump = [rr(-1, 1), rr(-1, 1), rr(-1, 1)];
  const loc = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2; const c = Math.cos(a), sn = Math.sin(a); const r = 1 + 0.05 * Math.sin(a * 3 + bump[0]) + 0.04 * Math.sin(a * 5 + bump[1]); loc.push([c * len / 2 * r * (c > 0 ? 1.0 : 0.94), sn * wdt / 2 * r * (1 - 0.12 * c)]); }
  const shp = loc.map(T); const path = polyPath(shp); erase(path);
  const inv = (px, py) => [(px - x) * Math.cos(-rot) - (py - y) * Math.sin(-rot), (px - x) * Math.sin(-rot) + (py - y) * Math.cos(-rot)];
  const dfn = (px, py) => { const [lx, ly] = inv(px, py); const hl = Math.hypot(lx / (len / 2) + 0.2, (ly / (wdt / 2) + 0.42) * 1.6); return clamp(0.82 + ly / (wdt / 2) * 0.25 + lx / len * 0.1 - smooth(0, 0.45, 0.42 - hl) * 0.95); };
  hatchRegion(path, rot + 0.05, 1.15, dfn, { th: 0.15, w: 0.95, bbox: [x - len, y - len, x + len, y + len], wave: 0.5, gain: 1.6 });
  hatchRegion(path, rot + 1.1, 1.5, (a, b) => dfn(a, b) - 0.15, { th: 0.45, w: 0.8, bbox: [x - len, y - len, x + len, y + len] });
  // wrinkles: wavy creases with a light edge
  for (let i = 0; i < 5; i++) {
    const yy = rr(-0.32, 0.36) * wdt, x0 = rr(-0.42, -0.1) * len, x1 = rr(0.05, 0.42) * len;
    const pts = bez([x0, yy], [x0 / 2, yy + rr(-2.5, 2.5)], [x1 / 2, yy + rr(-2.5, 2.5)], [x1, yy + rr(-2, 2)], 20);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; line(pts.map(p => T([p[0], p[1] - 1.1])).map(p => [...p, 0.8]), { w: 0.9, taper: 0.4 }); ctx.restore();
    line(pts.map(T).map(p => [...p, 0.9]), { w: 0.8, taper: 0.4 });
  }
  contour(shp.map((p, i) => [...p, 1 + 0.4 * Math.sin(i / shp.length * 6.28 - 1.6)]), { w: o.w ?? 1.4, double: false });
  // stem cap
  const c = T([-len / 2 + 2, 0]); const cp = ellipsePts(c[0], c[1], 2.2, 3.4, 0, 7, 14, rot); erase(polyPath(cp)); line(cp.map(p => [...p, 1]), { w: 0.9 });
}
function cardamom(x, y, len, rot, o = {}) {
  const wdt = len * 0.46;
  const T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  const loc = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; const cx = Math.cos(a), sy = Math.sin(a); loc.push([cx * len / 2, sy * wdt / 2 * Math.pow(1 - Math.pow(Math.abs(cx), 2.2), 0.5) * 1.1]); }
  const shp = loc.map(T); const path = polyPath(shp); erase(path);
  const dfn = (px, py) => { const ly = (px - x) * Math.sin(-rot) + (py - y) * Math.cos(-rot); return clamp(0.3 + ly / (wdt / 2) * 0.45); };
  hatchRegion(path, rot, 1.4, dfn, { th: 0.25, w: 0.7, bbox: [x - len, y - len, x + len, y + len], wave: 0.2 });
  for (const f of [-0.15, 0.2]) line(bez([-len / 2 * 0.9, 0], [-len * 0.2, f * wdt * 1.4], [len * 0.2, f * wdt * 1.4], [len / 2 * 0.9, 0], 20).map(T).map(p => [...p, 1]), { w: 0.75, taper: 0.4 });
  contour(shp.map(p => [...p, 1]), { w: 1.1, double: false });
  const tip = T([len / 2, 0]); line([tip, [tip[0] + Math.cos(rot) * 2.5, tip[1] + Math.sin(rot) * 2.5]], { w: 1.0, taper: 0.5 });
}
function petal(x, y, size, rot, o = {}) { // rounded, heart topped rose petal; base at (x,y)
  const sq = o.sq ?? 1;
  const T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + (p[0] * Math.sin(rot) + p[1] * Math.cos(rot)) * sq];
  const s = size;
  const loc = catmull([[0, 0], [s * 0.22, -s * 0.3], [s * 0.6, -s * 0.55], [s * 0.95, -s * 0.42], [s * 1.04, -s * 0.12], [s * 0.96, 0.02 * s], [s * 1.05, s * 0.2], [s * 0.92, s * 0.48], [s * 0.55, s * 0.52], [s * 0.2, s * 0.28], [0, 0]], 8);
  const shp = loc.map(T); const path = polyPath(shp); erase(path);
  const dfn = (px, py) => { const lx = (px - x) * Math.cos(-rot) + (py - y) * Math.sin(-rot); return clamp((o.dark ?? 0.12) + (1 - lx / s) * 0.5); };
  hatchRegion(path, rot, 1.45, dfn, { th: 0.28, w: 0.7, bbox: [x - s * 1.3, y - s * 1.3, x + s * 1.3, y + s * 1.3], wave: 0.25, bend: t => t * t * 3 });
  contour(shp.map((p, i) => [...p, 0.8 + 0.5 * Math.sin(i / shp.length * 6.28)]), { w: 1.1, double: false });
  for (const a of [-0.35, 0, 0.35]) line([[s * 0.06, 0], [s * 0.45 * Math.cos(a), s * 0.45 * Math.sin(a)]].map(T).map(p => [...p, 0.6]), { w: 0.5, taper: 0.5, alpha: 0.7 });
  if (o.curl) { // rolled over edge
    const c = catmull([[s * 0.62, -s * 0.54], [s * 0.86, -s * 0.36], [s * 0.98, -s * 0.12]], 10).map(T);
    line(c.map(p => [...p, 1]), { w: 1.2, taper: 0.3 });
  }
}
function leaf(x, y, len, rot, o = {}) {
  const wdt = len * (o.w ?? 0.38);
  const T = p => [x + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  const top = [], bot = [];
  for (let i = 0; i <= 30; i++) { const f = i / 30; const ww = Math.sin(Math.pow(f, 0.8) * Math.PI) * wdt / 2; const ser = o.serrate ? (i % 3 === 0 ? 1.2 : 0) : 0; top.push([f * len, -ww - ser]); bot.push([f * len, ww + ser * 0.6 + (o.bend ?? 0) * f * f * len * 0.15]); }
  const loc = [...top, ...bot.reverse()];
  const shp = loc.map(T); const path = polyPath(shp); erase(path);
  hatchRegion(path, rot + 0.9, 1.5, (px, py) => { const ly = (px - x) * Math.sin(-rot) + (py - y) * Math.cos(-rot); return clamp((o.dark ?? 0.35) + ly / (wdt / 2) * 0.35); }, { th: 0.3, w: 0.7, bbox: [x - len * 1.1, y - len * 1.1, x + len * 1.1, y + len * 1.1] });
  contour(shp.map(p => [...p, 1]), { w: 1.1, double: false });
  line([[0, 0], [len * 0.3, 0.5], [len * 0.95, 0]].map(T).map(p => [...p, 1]), { w: 0.9, taper: 0.4 });
  for (let i = 1; i < 6; i++) { const f = i / 6.5; for (const sg of [-1, 1]) line([[f * len, 0], [(f + 0.12) * len, sg * wdt * 0.38 * Math.sin(f * Math.PI)]].map(T).map(p => [...p, 0.8]), { w: 0.55, taper: 0.4 }); }
}
function coffeeBranch(x, y, len, rot, flip = 1) { // leaves + cherries for the emblem
  const T = p => [x + p[0] * Math.cos(rot) - p[1] * flip * Math.sin(rot), y + p[0] * Math.sin(rot) + p[1] * flip * Math.cos(rot)];
  const stem = []; for (let i = 0; i <= 30; i++) { const f = i / 30; stem.push([f * len, Math.sin(f * 2.2) * len * 0.08]); }
  line(stem.map(T).map((p, i) => [...p, 1.3 - i / 40]), { w: 2.0, taper: 0.3 });
  for (let i = 1; i <= 5; i++) {
    const f = i / 5.6; const b = T([f * len, Math.sin(f * 2.2) * len * 0.08]);
    const side = i % 2 ? -1 : 1; const ang = rot + flip * side * (0.75 - f * 0.25);
    leaf(b[0], b[1], len * (0.42 - f * 0.12), ang, { w: 0.4, dark: 0.3 });
    if (i % 2 === 0) for (let k = 0; k < 3; k++) { const cxx = b[0] + rr(-5, 5), cyy = b[1] + rr(-3, 6) + 4; const cp = polyPath(ellipsePts(cxx, cyy, 4.2, 4.6, 0, 7, 24)); erase(cp); hatchRegion(cp, 0.7, 1.2, (a, bb) => clamp(0.4 + (a - cxx) / 5 * 0.4 + (bb - cyy) / 5 * 0.3), { th: 0.3, w: 0.7, bbox: [cxx - 6, cyy - 6, cxx + 6, cyy + 6] }); contour(ellipsePts(cxx, cyy, 4.2, 4.6).map(q => [...q, 1]), { w: 1.0, double: false }); }
  }
}
function beans(list) { for (const b of list) bean(...b); }
