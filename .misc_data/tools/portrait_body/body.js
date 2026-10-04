// Builds a static lower-body mesh for a portrait bust: the bust's bottom-edge vertices extruded straight down
// to hip level, in rows, with the quads split along alternating diagonals (checkerboard).
// Output: body<t>/body.gltf (+ .bin) and body<t>/attrs.json (per-vertex bake attributes).
const fs = require('fs');
const { loadGltf } = require('./render');
const { rimCuts } = require('./rim');

const CFG = {
  '01': { yc: 10, zhip: 150, K: 30, band: { z0: 101, z1: 119 } }, // nomad: brown robe
  '02': { yc: 5, zhip: 140, K: 30, band: { z0: 94, z1: 108 } },   // envoy: white kaftan + orange cape
};
const W = 1024, H = 512, SOFF = 6, TUCK_UP = 3, TUCK_IN = 1, COL_STEP = 3.5;

// the bust's bottom edge: boundary edges that carry the lowest surface point at some angle, as an ordered vertex chain
function bottomChain(bust, yc) {
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
  const verts = new Map(); // welded id -> representative vertex index
  for (const c of cuts) {
    if (c.best.z < zTop - 22 || Math.abs(c.th) > 2.6) continue; // the open back rises steeply; stop there
    const a = w[c.best.ea], b = w[c.best.eb], k = a < b ? a + '_' + b : b + '_' + a;
    if (edgeCount.get(k) !== 1) continue; // only real boundary edges
    if (!verts.has(a)) verts.set(a, c.best.ea);
    if (!verts.has(b)) verts.set(b, c.best.eb);
  }
  const ang = i => Math.atan2(bust.pos[i][0], -(bust.pos[i][1] - yc));
  const chain = [...verts.entries()].map(([id, i]) => {
    const dup = bust.pos.map((_, k) => k).filter(k => w[k] === id);
    const n = [0, 1, 2].map(c => dup.reduce((s, k) => s + bust.nrm[k][c], 0)); const l = Math.hypot(...n);
    return { i, p: bust.pos[i].slice(), nrm: n.map(v => v / l), th: ang(i) };
  });
  chain.sort((p, q) => p.th - q.th);
  // drop end vertices that sit far above their neighbour (the start of the open back edge)
  while (chain.length > 2 && chain[0].p[2] < chain[1].p[2] - 10) chain.shift();
  while (chain.length > 2 && chain[chain.length - 1].p[2] < chain[chain.length - 2].p[2] - 10) chain.pop();
  return chain;
}

function build(t) {
  const c = CFG[t];
  const bust = loadGltf(`g${t}/out.gltf`);
  const chain = bottomChain(bust, c.yc);
  // columns: the chain vertices plus evenly spaced points on each edge between them (positions and normals lerped)
  const cols = [];
  for (let i = 0; i < chain.length; i++) {
    const A = chain[i];
    cols.push({ p: A.p, bn: A.nrm, corner: i });
    if (i === chain.length - 1) break;
    const B = chain[i + 1], L = Math.hypot(B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]);
    const n = Math.max(0, Math.ceil(L / COL_STEP) - 1);
    for (let k = 1; k <= n; k++) {
      const f = k / (n + 1), bn = A.nrm.map((v, q) => v * (1 - f) + B.nrm[q] * f), l = Math.hypot(...bn);
      cols.push({ p: A.p.map((v, q) => v * (1 - f) + B.p[q] * f), bn: bn.map(v => v / l), seg: i, f });
    }
  }
  const NC = cols.length;
  // horizontal outward normal per chain vertex (average of its two edges), lerped along each edge
  const hn = chain.map((v, i) => {
    const pa = chain[Math.max(0, i - 1)].p, pb = chain[Math.min(chain.length - 1, i + 1)].p;
    let n = [pb[1] - pa[1], -(pb[0] - pa[0])]; // perpendicular to the chain tangent in x-y
    if (n[0] * v.p[0] + n[1] * (v.p[1] - c.yc) < 0) n = n.map(x => -x);
    const l = Math.hypot(...n); return [n[0] / l, n[1] / l, 0];
  });
  for (const col of cols) {
    let n = col.corner !== undefined ? hn[col.corner] : hn[col.seg].map((v, q) => v * (1 - col.f) + hn[col.seg + 1][q] * col.f);
    const l = Math.hypot(...n); col.hn = n.map(v => v / l);
    col.th = Math.atan2(col.p[0], -(col.p[1] - c.yc));
  }
  // rim sampling for the texture (same cut the rim was found with), at every column's angle
  const cuts = rimCuts(bust, c.yc, cols.map(col => col.th), -60);
  cols.forEach((col, j) => {
    const b = cuts[j].best; col.z0 = col.p[2];
    col.rimUV = b ? b.uv : null; col.rimTri = b ? b.tri : null;
    col.upUV = b && b.up ? b.up.uv : null;
    const dz = b && b.up ? col.z0 - b.up.z : 5, dr = b && b.up ? b.r - b.up.r : 0, ul = Math.hypot(dz, dr) || 1;
    col.upDist = b && b.up ? ul : 0; col.upDir = [-dr / ul, -dz / ul]; // (r, z) direction up the bust surface
  });

  // grid: row -1 tucks a few units up behind the bust surface, rows 0..K go straight down to the hips
  const K = c.K, R = K + 2, P = [], N = [], ATTR = [];
  const vid = (j, k) => j * R + (k + 1);
  for (let j = 0; j < NC; j++) {
    const col = cols[j], rh = [Math.sin(col.th), -Math.cos(col.th)];
    for (let k = -1; k <= K; k++) {
      if (k === -1) {
        const up = col.upDir;
        P.push([col.p[0] + rh[0] * (up[0] * TUCK_UP - TUCK_IN), col.p[1] + rh[1] * (up[0] * TUCK_UP - TUCK_IN), col.p[2] + up[1] * TUCK_UP]);
        N.push(col.bn);
      } else {
        P.push([col.p[0], col.p[1], col.z0 + (c.zhip - col.z0) * (k / K)]);
        const w = k === 0 ? 1 : k === 1 ? 0.5 : 0; // bust normal at the seam, the wall's own normal below
        const m = col.bn.map((v, q) => v * w + col.hn[q] * (1 - w)), l = Math.hypot(...m);
        N.push(m.map(v => v / l));
      }
    }
  }
  // arc lengths: a along the chain from the front centre (identical on every row), s straight down from the rim
  const arc = [0]; for (let j = 1; j < NC; j++) arc.push(arc[j - 1] + Math.hypot(cols[j].p[0] - cols[j - 1].p[0], cols[j].p[1] - cols[j - 1].p[1]));
  let j0 = 0; while (j0 < NC - 1 && cols[j0 + 1].th < 0) j0++;
  const f0 = (0 - cols[j0].th) / (cols[j0 + 1].th - cols[j0].th), a0 = arc[j0] + (arc[j0 + 1] - arc[j0]) * f0;
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
  // quads split along alternating diagonals, wound so the face looks outward
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
  // bottom: a fan under the open shell
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
  // tangents (T = -dP/du like the bust export; w = 1)
  const T = P.map(() => [0, 0, 0]);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, d] = [idx[i], idx[i + 1], idx[i + 2]];
    const e1 = P[b].map((v, q) => v - P[a][q]), e2 = P[d].map((v, q) => v - P[a][q]);
    const du1 = UV[b][0] - UV[a][0], dv1 = UV[b][1] - UV[a][1], du2 = UV[d][0] - UV[a][0], dv2 = UV[d][1] - UV[a][1];
    const r = du1 * dv2 - du2 * dv1; if (Math.abs(r) < 1e-12) continue;
    const t3 = e1.map((v, q) => -(v * dv2 - e2[q] * dv1) / r);
    for (const v of [a, b, d]) for (let q = 0; q < 3; q++) T[v][q] += t3[q];
  }
  const TAN = T.map((t3, i) => {
    const n = N[i], dt = t3[0] * n[0] + t3[1] * n[1] + t3[2] * n[2];
    let o = t3.map((v, q) => v - n[q] * dt); let l = Math.hypot(...o);
    if (l < 1e-9) { o = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const d2 = o[0] * n[0] + o[1] * n[1] + o[2] * n[2]; o = o.map((v, q) => v - n[q] * d2); l = Math.hypot(...o); }
    return [o[0] / l, o[1] / l, o[2] / l, 1];
  });
  const outCols = cols.map(col => ({ th: col.th, valid: true, rimUV: col.rimUV, upUV: col.upUV, upDist: col.upDist, rimTri: col.rimTri, z0: col.z0, r0: Math.hypot(col.p[0], col.p[1] - c.yc) }));
  return { P, N, UV, TAN, idx, ATTR, rho, chain, cols: outCols, meta: { NC, K, R, W, H, SOFF, rho, amax, smax, yc: c.yc, zhip: c.zhip, band: c.band, closed: false } };
}

function writeGltf(dir, m) {
  fs.mkdirSync(dir, { recursive: true });
  const nv = m.P.length;
  const f32 = arr => { const b = Buffer.alloc(arr.length * arr[0].length * 4); let o = 0; for (const e of arr) for (const v of e) { b.writeFloatLE(v, o); o += 4; } return b; };
  const pos = f32(m.P), nrm = f32(m.N), tan = f32(m.TAN), uv = f32(m.UV);
  const ib = Buffer.alloc(m.idx.length * 2); m.idx.forEach((v, i) => ib.writeUInt16LE(v, i * 2));
  const parts = [pos, nrm, tan, uv, ib]; let off = 0; const views = [];
  for (const p of parts) { views.push({ buffer: 0, byteOffset: off, byteLength: p.length }); off += p.length; while (off % 4) off++; }
  const bin = Buffer.alloc(off); parts.forEach((p, i) => p.copy(bin, views[i].byteOffset));
  fs.writeFileSync(`${dir}/body.bin`, bin);
  const mn = [0, 1, 2].map(k => Math.min(...m.P.map(p => p[k]))), mx = [0, 1, 2].map(k => Math.max(...m.P.map(p => p[k])));
  const g = {
    asset: { version: '2.0', generator: 'portrait body generator' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'body', mesh: 0 }],
    meshes: [{ name: 'body', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TANGENT: 2, TEXCOORD_0: 3 }, indices: 4, material: 0 }] }],
    materials: [{ name: 'body', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }],
    buffers: [{ uri: 'body.bin', byteLength: bin.length }],
    bufferViews: views.map((v, i) => ({ ...v, target: i < 4 ? 34962 : 34963 })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min: mn, max: mx },
      { bufferView: 1, componentType: 5126, count: nv, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: nv, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: nv, type: 'VEC2' },
      { bufferView: 4, componentType: 5123, count: m.idx.length, type: 'SCALAR' },
    ],
  };
  fs.writeFileSync(`${dir}/body.gltf`, JSON.stringify(g, null, 1));
  fs.writeFileSync(`${dir}/attrs.json`, JSON.stringify({ meta: m.meta, attr: m.ATTR, cols: m.cols }));
}

module.exports = { build, CFG };
if (require.main === module) {
  for (const t of process.argv.slice(2)) {
    const m = build(t);
    writeGltf(`body${t}`, m);
    console.log(t, 'rim vertices', m.chain.length, 'columns', m.meta.NC, 'verts', m.P.length, 'tris', m.idx.length / 3,
      'rho px/unit', m.rho.toFixed(3), 'angles', (m.chain[0].th * 180 / Math.PI).toFixed(0), '..', (m.chain[m.chain.length - 1].th * 180 / Math.PI).toFixed(0));
  }
}
