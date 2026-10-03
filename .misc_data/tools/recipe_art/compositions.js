'use strict';
function beanPile(cx, cy, n, spread, size = 23) {
  const list = [];
  for (let i = 0; i < n; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * spread; list.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.45, size * rr(0.88, 1.08), R() * 6.28]); }
  list.sort((a, b) => a[1] - b[1]);
  castShadow(cx + 6, cy + 6, spread + size * 0.6, (spread * 0.45 + size * 0.4), { k: 0.7 });
  for (const b of list) bean(...b);
}
function powderMound(v) {
  const [y1, r1] = v.yr(1);
  const top = y1 - r1 * 0.55;
  const pts = []; for (let i = 0; i <= 60; i++) { const f = i / 60, a = Math.PI + Math.PI * f; pts.push([v.cx + Math.cos(a) * r1 * 0.92, y1 + 2 + Math.sin(a) * (y1 - top) * (0.85 + 0.15 * Math.sin(f * 9))]); }
  const front = ellipsePts(v.cx, y1, r1 * 0.92, r1 * v.k * 0.92, 0, Math.PI, 40);
  const shape = polyPath([...pts, ...front]); erase(shape);
  stipple(shape, 7000, (x, y) => clamp(0.14 + (x - v.cx) / r1 * 0.5 + (y - top) / (y1 - top) * 0.3), { bbox: [v.cx - r1, top - 4, v.cx + r1, y1 + r1 * v.k], r: 0.5 });
  contour(pts.map(p => [...p, 0.9]), { w: 1.1 });
  // a few whole pods on top of the powder
  cardamom(v.cx + r1 * 0.25, top + 10, r1 * 0.5, 0.5);
}
function datesIn(v) {
  const [y1, r1] = v.yr(1);
  const list = [];
  const L = r1 * 0.46;
  const spots = [[-0.55, -0.55], [-0.05, -0.62], [0.48, -0.5], [-0.78, -0.12], [-0.3, -0.2], [0.22, -0.25], [0.7, -0.08], [-0.55, 0.25], [0.0, 0.18], [0.5, 0.28], [-0.2, -0.95], [0.25, -0.95]];
  for (const [fx, fy] of spots) list.push([v.cx + fx * r1 * 0.95 + rr(-4, 4), y1 + fy * r1 * 0.42 - 4 + rr(-2, 2), L * rr(0.92, 1.08), rr(-0.6, 0.6) + fx * 0.35]);
  list.sort((a, b) => a[1] - b[1]);
  for (const d of list) dateFruit(...d);
}
const SCENES = {
  plain: {
    seed: 21, draw() {
      castShadow(210, 304, 125, 20);
      cezve(170, 300, 2.05, { handle: 0.5 });
      steam(166, 128, 56, { n: 2, gap: 16, amp: 6 });
      fincan(312, 338, 1.5);
      steam(308, 262, 66);
      beanPile(84, 362, 10, 56, 27);
      bean(398, 380, 25, 2.4); bean(372, 392, 23, 0.9);
    }
  },
  milk: {
    seed: 33, draw() {
      castShadow(150, 293, 92, 17);
      milkJug(124, 290, 1.9);
      castShadow(305, 350, 82, 14);
      saucer(290, 352, 1.32, { band: true });
      glassCup(290, 348, 1.8);
      steam(290, 166, 50, { n: 2, gap: 16, amp: 6 });
      beanPile(74, 366, 9, 48, 26);
      bean(400, 382, 24, 1.8);
    }
  },
  cardamom: {
    seed: 45, draw() {
      castShadow(215, 320, 108, 18);
      dallah(194, 318, 1.62);
      const f1 = finjan(334, 322, 1.42); steam(334, 268, 46, { n: 2, gap: 12 });
      castShadow(270, 376, 36, 9, { k: 0.7 });
      finjan(262, 373, 1.15);
      castShadow(108, 380, 60, 11, { k: 0.7 });
      bowl(94, 380, 1.08, { fill: powderMound, prof: [[0, 18], [2, 22], [4, 21], [10, 32], [18, 42], [22, 45], [24, 46]] });
      for (const [x, y, l, r] of [[24, 368, 24, 0.4], [178, 386, 23, -0.5], [160, 364, 22, 1.9], [36, 393, 23, 2.6], [140, 395, 22, 0.1]]) cardamom(x, y, l, r);
      beanPile(352, 384, 6, 26, 24);
    }
  },
  dates: {
    seed: 57, draw() {
      castShadow(130, 272, 70, 13);
      cezve(108, 270, 1.35, { handle: 0.4 });
      steam(104, 160, 44, { n: 2, gap: 12, amp: 5 });
      castShadow(305, 334, 122, 20);
      bowl(287, 330, 2.42, { fill: datesIn });
      castShadow(176, 370, 48, 11, { k: 0.8 });
      finjan(158, 368, 1.55); steam(158, 310, 50, { n: 2, gap: 12 });
      dateFruit(240, 386, 42, -0.25); dateFruit(392, 384, 40, 0.35);
      beanPile(52, 374, 6, 34, 25);
    }
  },
  rose: {
    seed: 69, draw() {
      castShadow(112, 302, 66, 13);
      gulabdan(92, 300, 1.75);
      castShadow(318, 326, 100, 17);
      const { lq } = fincan(302, 318, 1.55, { crema: 6 });
      ctx.save(); ctx.clip(lq.path);
      for (const [dx, dy, sz, rt] of [[-34, 0, 30, 0.2], [26, 2, 27, 2.9]]) petal(302 + dx, lq.y + dy, sz, rt, { curl: 1, dark: 0.32, sq: 0.45 });
      ctx.restore();
      steam(296, 236, 60);
      // a cut rose lying in front, stem and leaves to the right
      castShadow(222, 378, 80, 12, { k: 0.75 });
      tube(catmull([[236, 372], [290, 384], [350, 386], [420, 392]], 10), q => 3.0, { capEnd: true });
      leaf(300, 386, 58, -0.6, { serrate: true, w: 0.45, dark: 0.35 });
      leaf(356, 388, 46, 0.45, { serrate: true, w: 0.45, dark: 0.45 });
      for (const [sx, sy, a] of [[240, 362, -0.6], [244, 380, 0.6]]) leaf(sx, sy, 22, a + Math.PI, { w: 0.3, dark: 0.55 });
      roseBloom(200, 350, 50, -0.15, { dark: 0.16 });
      petal(122, 388, 24, -0.3, { dark: 0.2, sq: 0.7 }); petal(404, 346, 22, 2.3, { curl: 1, dark: 0.2, sq: 0.7 });
      beanPile(52, 370, 8, 38, 25);
    }
  },
  honey: {
    seed: 81, draw() {
      castShadow(325, 286, 105, 19);
      honeyPot(300, 282, 2.15);
      castShadow(160, 346, 104, 18);
      fincan(142, 342, 1.66);
      steam(138, 254, 66);
      // honey puddle + dipper resting in front, dripping
      const pud = polyPath(ellipsePts(352, 386, 34, 8, 0, 7, 40)); erase(pud); hatchRegion(pud, 0.05, 1.3, (x, y) => clamp(0.3 + (x - 352) / 34 * 0.45 + (y - 386) / 8 * 0.2), { th: 0.2, bbox: [316, 376, 390, 396] }); contour(ellipsePts(352, 386, 34, 8).map(p => [...p, 1]), { w: 1.1, double: false });
      const hd = dipper(222, 392, 398, 318, 1.45);
      const drip = catmull([[hd.head[0] - 2, hd.head[1] + hd.w * 0.7], [hd.head[0] - 1, hd.head[1] + hd.w + 14], [hd.head[0] - 3, 384]], 10);
      tube(drip, q => 2.8 * (1 - q * 0.35), { step: 1.0 });
      beanPile(50, 376, 6, 32, 25);
    }
  },
  mood: {
    seed: 93, draw() {
      const cx = 210, base = 352, top0 = 200, rx = 150;
      const arch = []; for (let i = 0; i <= 160; i++) { const f = i / 160, a = Math.PI * (1.0 + f); let x = cx + Math.cos(a) * rx * 0.93, y = top0 + Math.sin(a) * rx; y -= Math.pow(Math.max(0, 1 - Math.abs(f - 0.5) * 2), 3) * 24; arch.push([x, y]); }
      const frame = [[cx - rx * 0.93, base], ...arch, [cx + rx * 0.93, base]];
      contour(frame.map(p => [...p, 1.2]), { w: 1.7 });
      const inner = frame.map(p => [cx + (p[0] - cx) * 0.94, top0 + (p[1] - top0) * 0.94 + 8]);
      line(inner.map(p => [...p, 0.8]), { w: 0.9, taper: 0.05 });
      const outer = frame.map(p => [cx + (p[0] - cx) * 1.055, top0 + (p[1] - top0) * 1.05 - 6]);
      for (const p of resample(outer, 6.5)) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.25, 0, 7); ctx.fill(); }
      const sx = cx, sy = 26; const star = []; for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + i * Math.PI / 8; const r = i % 2 ? 6 : 13; star.push([sx + Math.cos(a) * r, sy + Math.sin(a) * r]); }
      erase(polyPath(star)); contour(star.map(p => [...p, 1]), { w: 1.2, double: false });
      // floor line inside the arch
      line([[cx - rx * 0.88, 344], [cx + rx * 0.88, 344]].map(p => [...p, 1]), { w: 1.0, taper: 0.1 });
      // shaded niche (right half darker)
      const niche = polyPath(inner);
      hatchRegion(niche, 1.15, 2.6, (x, y) => clamp(0.08 + (x - cx) / rx * 0.32 + (1 - (y - 50) / 300) * 0.06), { th: 0.12, w: 0.6, bbox: [cx - rx, 40, cx + rx, base] });
      castShadow(232, 336, 96, 14);
      dallah(214, 334, 1.3);
      steam(98, 150, 40, { n: 2, gap: 10, amp: 4 });
      coffeeBranch(198, 394, 128, Math.PI + 0.3, 1);
      coffeeBranch(222, 394, 128, -0.3, -1);
    }
  },
};
