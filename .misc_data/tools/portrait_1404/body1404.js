// Static lower body for a 1404 portrait bust, the Nomad/Envoy method (portrait_body/body.js) generalised:
// the bust's bottom-edge vertices extruded straight down to hip level, in rows, checkerboard triangulation,
// a tuck row behind the seam and a fan closing the bottom.
// body.js assumes the body axis at x = 0 and the face along -y. Here the bust is first moved into that frame:
// centred on its lower third (x/y), turned by its eye line's deviation so the face looks along -y (Lord Northburg
// and the Sick Emperor are modelled turned), then the body is built there and moved back.
// build(bustGltf, { zhip }) -> { P, N, UV, TAN, idx, ATTR, chain, cols, meta }  (mesh space of the bust)
const path = require('path');
const MOD = process.env.ORIENT_MOD || path.resolve(__dirname, '../../..');
const { loadGltf } = require(path.join(MOD, '.misc_data/tools/portrait_body/render.js'));
const { rimCuts } = require(path.join(MOD, '.misc_data/tools/portrait_body/rim.js'));

const W = 1024, H = 512, SOFF = 6, TUCK_UP = 3, TUCK_IN = 1, COL_STEP = 3.5, K = 30;

function frameOf(bust, eyeYawDev) {
  const zs = bust.pos.map(p => p[2]), zmin = Math.min(...zs), zmax = Math.max(...zs);
  const low = bust.pos.filter(p => p[2] > zmax - (zmax - zmin) / 3);
  const xc = low.reduce((s, p) => s + p[0], 0) / low.length, yc = low.reduce((s, p) => s + p[1], 0) / low.length;
  const phi = eyeYawDev * Math.PI / 180;
  // canonical = R(-phi) · (p - c); the face direction (eye line turned by phi) becomes -y
  const c = Math.cos(-phi), s = Math.sin(-phi), ci = Math.cos(phi), si = Math.sin(phi);
  return {
    xc, yc, phi,
    to: p => { const x = p[0] - xc, y = p[1] - yc; return [c * x - s * y, s * x + c * y, p[2]]; },
    toN: n => [c * n[0] - s * n[1], s * n[0] + c * n[1], n[2]],
    from: p => [ci * p[0] - si * p[1] + xc, si * p[0] + ci * p[1] + yc, p[2]],
    fromN: n => [ci * n[0] - si * n[1], si * n[0] + ci * n[1], n[2]],
  };
}

// the bust's bottom edge (as body.js): boundary edges that carry the lowest surface point at some angle
function bottomChain(bust, yc, backLimit, rise) {
  const key = p => p.map(v => v.toFixed(3)).join(','), wid = new Map();
  const w = bust.pos.map(p => { const k = key(p); if (!wid.has(k)) wid.set(k, wid.size); return wid.get(k); });
  const edgeCount = new Map();
  for (let i = 0; i < bust.idx.length; i += 3) for (let e = 0; e < 3; e++) {
    const a = w[bust.idx[i + e]], b = w[bust.idx[i + (e + 1) % 3]], k = a < b ? a + '_' + b : b + '_' + a;
    edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
  }
  const N = 2880, angles = [...Array(N).keys()].map(k => (k / N) * 2 * Math.PI - Math.PI);
  const cuts = rimCuts(bust, yc, angles, -60).filter(c => c.best);
  const zTop = Math.max(...cuts.map(c => c.best.z));
  const verts = new Map();
  for (const c of cuts) {
    if (c.best.z < zTop - rise || Math.abs(c.th) > backLimit) continue;
    const a = w[c.best.ea], b = w[c.best.eb], k = a < b ? a + '_' + b : b + '_' + a;
    if (edgeCount.get(k) !== 1) continue;
    if (bust.still && !(bust.still[c.best.ea] && bust.still[c.best.eb])) continue; // a moving edge (hair) is no rim
    if (!verts.has(a)) verts.set(a, c.best.ea);
    if (!verts.has(b)) verts.set(b, c.best.eb);
  }
  const ang = i => Math.atan2(bust.pos[i][0], -(bust.pos[i][1] - yc));
  const chain = [...verts.entries()].map(([id, i]) => {
    const dup = bust.pos.map((_, k) => k).filter(k => w[k] === id);
    const n = [0, 1, 2].map(c => dup.reduce((s, k) => s + bust.nrm[k][c], 0)); const l = Math.hypot(...n) || 1;
    return { i, p: bust.pos[i].slice(), nrm: n.map(v => v / l), th: ang(i) };
  });
  chain.sort((p, q) => p.th - q.th);
  while (chain.length > 2 && chain[0].p[2] < chain[1].p[2] - 10) chain.shift();
  while (chain.length > 2 && chain[chain.length - 1].p[2] < chain[chain.length - 2].p[2] - 10) chain.pop();
  if (chain.length >= 3) return chain;
  // closed bottom (Willem van der Mark: a flat cap): the outer perimeter of the lowest flat region, one vertex per 3°
  const flat = [...new Set(w)].map(id => bust.pos.findIndex((_, k) => w[k] === id)).filter(i => bust.pos[i][2] > zTop - 1 && (!bust.still || bust.still[i]));
  const best = new Map();
  for (const i of flat) {
    const th = ang(i); if (Math.abs(th) > backLimit) continue;
    const bin = Math.round(th / (3 * Math.PI / 180)), r = Math.hypot(bust.pos[i][0], bust.pos[i][1] - yc);
    if (!best.has(bin) || r > best.get(bin).r) best.set(bin, { i, r });
  }
  const ring = [...best.values()].map(({ i }) => ({ i, p: bust.pos[i].slice(), th: ang(i) })).sort((p, q) => p.th - q.th);
  for (const v of ring) { // wall normal: horizontal, outward
    const l = Math.hypot(v.p[0], v.p[1] - yc) || 1; v.nrm = [v.p[0] / l, (v.p[1] - yc) / l, 0];
  }
  return ring;
}

function build(bustGltf, opts) {
  const src = loadGltf(bustGltf);
  const F = frameOf(src, opts.eyeYawDev || 0);
  // leave out triangles that move as a whole (opts.still[v] false for all three): the Witch's hair strands hang down
  // to the rim and swing with the head. Garment triangles at the rim keep their still rim vertices.
  let idx0 = src.idx;
  if (opts.still) { idx0 = []; for (let i = 0; i < src.idx.length; i += 3) if (opts.still[src.idx[i]] || opts.still[src.idx[i + 1]] || opts.still[src.idx[i + 2]]) idx0.push(src.idx[i], src.idx[i + 1], src.idx[i + 2]); }
  const bust = { pos: src.pos.map(F.to), nrm: src.nrm.map(F.toN), uv: src.uv, idx: idx0, joints: src.joints, still: opts.still };
  const yc = 0;
  const chain = bottomChain(bust, yc, opts.backLimit || 2.6, opts.rise || 22);
  if (chain.length < 3) throw new Error('no bottom edge found');
  const zhip = opts.zhip;
  const cols = [];
  for (let i = 0; i < chain.length; i++) {
    const A = chain[i];
    cols.push({ p: A.p, bn: A.nrm, corner: i });
    if (i === chain.length - 1) break;
    const B = chain[i + 1], L = Math.hypot(B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]);
    const n = Math.max(0, Math.ceil(L / COL_STEP) - 1);
    for (let k = 1; k <= n; k++) {
      const f = k / (n + 1), bn = A.nrm.map((v, q) => v * (1 - f) + B.nrm[q] * f), l = Math.hypot(...bn) || 1;
      cols.push({ p: A.p.map((v, q) => v * (1 - f) + B.p[q] * f), bn: bn.map(v => v / l), seg: i, f });
    }
  }
  const NC = cols.length;
  const hn = chain.map((v, i) => {
    const pa = chain[Math.max(0, i - 1)].p, pb = chain[Math.min(chain.length - 1, i + 1)].p;
    let n = [pb[1] - pa[1], -(pb[0] - pa[0])];
    if (n[0] * v.p[0] + n[1] * (v.p[1] - yc) < 0) n = n.map(x => -x);
    const l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, 0];
  });
  for (const col of cols) {
    const n = col.corner !== undefined ? hn[col.corner] : hn[col.seg].map((v, q) => v * (1 - col.f) + hn[col.seg + 1][q] * col.f);
    const l = Math.hypot(...n) || 1; col.hn = n.map(v => v / l);
    col.th = Math.atan2(col.p[0], -(col.p[1] - yc));
  }
  const cuts = rimCuts(bust, yc, cols.map(col => col.th), -60);
  cols.forEach((col, j) => {
    const b = cuts[j].best; col.z0 = col.p[2];
    col.rimUV = b ? b.uv : null; col.rimTri = b ? b.tri : null; col.upUV = b && b.up ? b.up.uv : null;
    const dz = b && b.up ? col.z0 - b.up.z : 5, dr = b && b.up ? b.r - b.up.r : 0, ul = Math.hypot(dz, dr) || 1;
    col.upDist = b && b.up ? ul : 0; col.upDir = [-dr / ul, -dz / ul];
  });
  const R = K + 2, P = [], N = [], ATTR = [];
  const vid = (j, k) => j * R + (k + 1);
  for (let j = 0; j < NC; j++) {
    const col = cols[j], rh = [Math.sin(col.th), -Math.cos(col.th)];
    for (let k = -1; k <= K; k++) {
      if (k === -1) {
        const up = col.upDir;
        P.push([col.p[0] + rh[0] * (up[0] * TUCK_UP - TUCK_IN), col.p[1] + rh[1] * (up[0] * TUCK_UP - TUCK_IN), col.p[2] + up[1] * TUCK_UP]);
        N.push(col.bn);
      } else {
        P.push([col.p[0], col.p[1], col.z0 + (zhip - col.z0) * (k / K)]);
        const w = k === 0 ? 1 : k === 1 ? 0.5 : 0;
        const m = col.bn.map((v, q) => v * w + col.hn[q] * (1 - w)), l = Math.hypot(...m) || 1;
        N.push(m.map(v => v / l));
      }
    }
  }
  const arc = [0]; for (let j = 1; j < NC; j++) arc.push(arc[j - 1] + Math.hypot(cols[j].p[0] - cols[j - 1].p[0], cols[j].p[1] - cols[j - 1].p[1]));
  let j0 = 0; while (j0 < NC - 2 && cols[j0 + 1].th < 0) j0++;
  const f0 = Math.max(0, Math.min(1, (0 - cols[j0].th) / ((cols[j0 + 1].th - cols[j0].th) || 1))), a0 = arc[j0] + (arc[j0 + 1] - arc[j0]) * f0;
  const S = [], A = [];
  for (let j = 0; j < NC; j++) for (let k = -1; k <= K; k++) {
    const i = vid(j, k);
    S[i] = k === -1 ? -Math.hypot(...P[i].map((v, q) => v - P[vid(j, 0)][q])) : P[i][2] - cols[j].z0;
    A[i] = arc[j] - a0;
  }
  const amax = Math.max(...A.map(Math.abs)), smax = Math.max(...S);
  const rho = Math.min((W / 2 - 8) / amax, (H - 24) / (SOFF + smax));
  const UV = P.map((_, i) => [0.5 + A[i] * rho / W, (SOFF + S[i]) * rho / H]);
  for (let j = 0; j < NC; j++) for (let k = -1; k <= K; k++) {
    const i = vid(j, k);
    ATTR.push({ th: cols[j].th, s: S[i], z: P[i][2], a: A[i], j, valid: 1, ao: 0, arm: 0 });
  }
  const idx = [];
  const tri = (x, y, z) => {
    const u = P[y].map((v, i) => v - P[x][i]), w = P[z].map((v, i) => v - P[x][i]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const o = [N[x][0] + N[y][0] + N[z][0], N[x][1] + N[y][1] + N[z][1], N[x][2] + N[y][2] + N[z][2]];
    if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] >= 0) idx.push(x, y, z); else idx.push(x, z, y);
  };
  for (let j = 0; j < NC - 1; j++) for (let k = -1; k < K; k++) {
    const a = vid(j, k), b = vid(j + 1, k), cc = vid(j, k + 1), d = vid(j + 1, k + 1);
    if ((j + k) % 2 === 0) { tri(a, b, d); tri(a, d, cc); } else { tri(a, b, cc); tri(b, d, cc); }
  }
  const bottom = [...Array(NC).keys()].map(j => P[vid(j, K)]);
  const cen = [0, 1, 2].map(q => bottom.reduce((s, p) => s + p[q], 0) / NC);
  const capC = P.length; P.push(cen); N.push([0, 0, 1]); UV.push([1 - 6 / W, 1 - 6 / H]); ATTR.push({ cap: 1 });
  const capStart = P.length;
  for (let j = 0; j < NC; j++) { P.push(bottom[j].slice()); N.push([0, 0, 1]); UV.push([1 - 6 / W, 1 - 6 / H]); ATTR.push({ cap: 1 }); }
  for (let j = 0; j < NC - 1; j++) {
    const a = capStart + j, b = capStart + j + 1;
    const u = P[a].map((v, i) => v - P[capC][i]), w = P[b].map((v, i) => v - P[capC][i]);
    if (u[0] * w[1] - u[1] * w[0] > 0) idx.push(capC, a, b); else idx.push(capC, b, a);
  }
  // back to the bust's mesh space (positions, normals); the bake works on the canonical attributes
  const Pm = P.map(F.from), Nm = N.map(F.fromN);
  const T = Pm.map(() => [0, 0, 0]);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, d] = [idx[i], idx[i + 1], idx[i + 2]];
    const e1 = Pm[b].map((v, q) => v - Pm[a][q]), e2 = Pm[d].map((v, q) => v - Pm[a][q]);
    const du1 = UV[b][0] - UV[a][0], dv1 = UV[b][1] - UV[a][1], du2 = UV[d][0] - UV[a][0], dv2 = UV[d][1] - UV[a][1];
    const r = du1 * dv2 - du2 * dv1; if (Math.abs(r) < 1e-12) continue;
    const t3 = e1.map((v, q) => -(v * dv2 - e2[q] * dv1) / r);
    for (const v of [a, b, d]) for (let q = 0; q < 3; q++) T[v][q] += t3[q];
  }
  const TAN = T.map((t3, i) => {
    const n = Nm[i], dt = t3[0] * n[0] + t3[1] * n[1] + t3[2] * n[2];
    let o = t3.map((v, q) => v - n[q] * dt); let l = Math.hypot(...o);
    if (l < 1e-9) { o = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const d2 = o[0] * n[0] + o[1] * n[1] + o[2] * n[2]; o = o.map((v, q) => v - n[q] * d2); l = Math.hypot(...o); }
    return [o[0] / l, o[1] / l, o[2] / l, 1];
  });
  const outCols = cols.map(col => ({ th: col.th, valid: true, rimUV: col.rimUV, upUV: col.upUV, upDist: col.upDist, rimTri: col.rimTri, z0: col.z0, r0: Math.hypot(col.p[0], col.p[1] - yc) }));
  return { P: Pm, N: Nm, UV, TAN, idx, ATTR, rho, chain: chain.map(c => c.i), cols: outCols, canonBust: bust,
    meta: { NC, K, R, W, H, SOFF, rho, amax, smax, yc, zhip, closed: false, frame: { xc: F.xc, yc: F.yc, phi: F.phi } } };
}
module.exports = { build, W, H };
