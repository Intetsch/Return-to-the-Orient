// Compares a converted portrait animation (rdm -> glTF via rdm4) against the 1404 ground truth:
// Granny skinning v' = v * IWT_bone * World_bone(t), with IWT from the .cn6 and World(t) from the .na2
// (both row-vector, translation in the last row). Reports per-vertex deviation in mesh units.
//
// node animcheck.js <mesh.cn6> <anim.na2> <roundtrip.gltf> [step]
const fs = require('fs'), path = require('path');

function parseCn6(f) {
  const L = fs.readFileSync(f, 'latin1').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('//'));
  let i = 1; const bones = [];
  while (!L[i].startsWith('meshes')) {
    const m = L[i].match(/^(\d+) "([^"]*)" (-?\d+) (.*)$/); const v = m[4].split(/\s+/).map(Number);
    bones.push({ name: m[2], parent: +m[3], pos: v.slice(0, 3), q: v.slice(3, 7), iwt: v.slice(7, 23) }); i++;
  }
  const verts = [];
  for (; i < L.length; i++) if (/^-?[\d.]+ /.test(L[i])) {
    const v = L[i].split(/\s+/).map(Number);
    if (v.length >= 34) verts.push({ p: v.slice(0, 3), uv: v.slice(12, 14), b: v.slice(18, 22), w: v.slice(26, 30).map(x => x / 255) });
  }
  return { bones, verts };
}

function parseNa2(f) {
  const L = fs.readFileSync(f, 'latin1').split(/\r?\n/);
  let i = 0; const hdr = {};
  while (!/^Bones:/.test(L[i])) { const m = L[i].match(/^(\w+): (\d+)/); if (m) hdr[m[1]] = +m[2]; i++; }
  const nb = +L[i].split(' ')[1]; i++;
  const bones = {};
  for (let b = 0; b < nb; b++) {
    const name = L[i++].trim(); const fr = [];
    for (let k = 0; k < hdr.FrameCount; k++) fr.push(L[i++].trim().split(/\s+/).map(Number));
    bones[name] = fr;
  }
  return { hdr, bones };
}

// row-vector 4x4 (array of 16, row-major): v * M
const mulRV = (v, M) => [0, 1, 2].map(c => v[0] * M[c] + v[1] * M[4 + c] + v[2] * M[8 + c] + M[12 + c]);
const mmRV = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) C[r * 4 + c] += A[r * 4 + k] * B[k * 4 + c]; return C; };

function loadGltf(file) {
  const g = JSON.parse(fs.readFileSync(file)), dir = path.dirname(file);
  const bufs = g.buffers.map(b => fs.readFileSync(path.join(dir, b.uri)));
  const acc = i => {
    const a = g.accessors[i], bv = g.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    const buf = bufs[bv.buffer], off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const sz = { 5126: 4, 5123: 2, 5125: 4, 5121: 1, 5122: 2, 5120: 1 }[a.componentType];
    const stride = bv.byteStride || n * sz;
    const out = [];
    for (let k = 0; k < a.count; k++) {
      const e = [];
      for (let c = 0; c < n; c++) {
        const o = off + k * stride + c * sz;
        e.push(a.componentType === 5126 ? buf.readFloatLE(o) : a.componentType === 5123 ? buf.readUInt16LE(o) : a.componentType === 5125 ? buf.readUInt32LE(o) : buf[o]);
      }
      out.push(n === 1 ? e[0] : e);
    }
    return out;
  };
  return { g, acc };
}

// column-vector 4x4 (column-major array of 16 as in glTF)
const mmCV = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) C[c * 4 + r] += A[k * 4 + r] * B[c * 4 + k]; return C; };
const mulCV = (M, v) => [0, 1, 2].map(r => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r]);
function trs(t, q, s) {
  const [x, y, z, w] = q, S = s || [1, 1, 1];
  const R = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
  return [R[0] * S[0], R[1] * S[0], R[2] * S[0], 0, R[3] * S[1], R[4] * S[1], R[5] * S[1], 0, R[6] * S[2], R[7] * S[2], R[8] * S[2], 0, t[0], t[1], t[2], 1];
}

function run(cn6File, na2File, gltfFile, step) {
  const cn = parseCn6(cn6File), na = parseNa2(na2File), { g, acc } = loadGltf(gltfFile);
  const prim = g.meshes[0].primitives[0], at = prim.attributes;
  const P = acc(at.POSITION), UV = acc(at.TEXCOORD_0), J = acc(at.JOINTS_0), Wt = acc(at.WEIGHTS_0);
  const skin = g.skins[0], IBM = acc(skin.inverseBindMatrices);
  const parent = {}; g.nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
  // animation: per node, path -> {times, values}
  const anim = {}; let nT = 0, tMax = 0;
  for (const ch of (g.animations && g.animations[0] ? g.animations[0].channels : [])) {
    const s = g.animations[0].samplers[ch.sampler]; const times = acc(s.input), vals = acc(s.output);
    (anim[ch.target.node] = anim[ch.target.node] || {})[ch.target.path] = { times, vals };
    nT = Math.max(nT, times.length); tMax = Math.max(tMax, times[times.length - 1]);
  }
  // na2 frame k is key k (Blender keys na2 frame k at scene frame k+1, exported at time (k+1)/fps);
  // channels with fewer keys (constant bones) are sampled by time
  const nFr = na.hdr.FrameCount;
  const sample = (tr, t) => {
    const { times, vals } = tr;
    if (times.length === nFr) { const k = Math.round(t); return vals[Math.max(0, Math.min(k, vals.length - 1))]; }
    const tt = tMax * (t + 1) / nFr;
    if (tt <= times[0]) return vals[0];
    for (let k = 1; k < times.length; k++) if (tt <= times[k]) { const f = (tt - times[k - 1]) / (times[k] - times[k - 1]), a = vals[k - 1], b = vals[k]; return a.map((x, i) => x + (b[i] - x) * f); }
    return vals[vals.length - 1];
  };
  const nodeLocal = (i, t) => { const n = g.nodes[i], an = anim[i] || {}; if (n.matrix && !an.rotation && !an.translation) return n.matrix; let q = an.rotation ? sample(an.rotation, t) : (n.rotation || [0, 0, 0, 1]); const l = Math.hypot(...q); q = q.map(x => x / l); return trs(an.translation ? sample(an.translation, t) : (n.translation || [0, 0, 0]), q, n.scale); };
  const globals = t => { const G = {}; const get = i => G[i] || (G[i] = parent[i] !== undefined ? mmCV(get(parent[i]), nodeLocal(i, t)) : nodeLocal(i, t)); g.nodes.forEach((_, i) => get(i)); return G; };

  // cn6 -> rdm space: (x, y, z) -> (x, z, -y)  [Blender Z-up import, glTF Y-up export]
  const map = v => [v[0], v[2], -v[1]];
  // match rdm vertices to cn6 vertices by position + uv
  const key = p => p.map(x => Math.round(x * 2)).join(',');
  const grid = new Map();
  cn.verts.forEach((v, i) => { const m = map(v.p); for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1]) { const k = [Math.round(m[0] * 2) + dx, Math.round(m[1] * 2) + dy, Math.round(m[2] * 2) + dz].join(','); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
  const match = P.map((p, i) => { let best = -1, bd = 1e9; for (const c of grid.get(key(p)) || []) { const m = map(cn.verts[c].p); const d = Math.hypot(m[0] - p[0], m[1] - p[1], m[2] - p[2]) + Math.hypot(cn.verts[c].uv[0] - UV[i][0], cn.verts[c].uv[1] - UV[i][1]) * 10; if (d < bd) { bd = d; best = c; } } return { c: best, d: bd }; });
  const unmatched = match.filter(m => m.c < 0 || m.d > 1).length;

  const nFrames = na.hdr.FrameCount;
  const stepN = step || 10;
  // Two references: "full" = Granny with every bone animated; "noroot" = what the pipeline is meant to give:
  // the cn6 importer deletes the root bone (DELETE_TOP_BONE), so root weight is dropped and the rest renormalized,
  // and root-only vertices stay static (glTF neutral_bone). The noroot error isolates real conversion faults.
  let maxE = 0, sumE = 0, cnt = 0, worst = null; const errs = []; const boneErr = {};
  let maxN = 0, worstN = null; const errsN = []; const boneErrN = {};
  const iwt = cn.bones.map(b => b.iwt);
  const na2Root = Object.keys(na.bones)[0];
  const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  // glTF names are decoded UTF-8, the .cn6/.na2 are read as latin1 bytes (the corsair's strähne_links)
  const jointOf = {}; skin.joints.forEach((j, ji) => jointOf[Buffer.from(g.nodes[j].name, 'utf8').toString('latin1')] = ji);
  const probesOf = cn.bones.map((b, bi) => cn.verts.filter(v => v.w.some((w, q) => w > 0 && v.b[q] === bi)));
  const boneXform = {};
  for (let k = 0; k < nFrames; k += stepN) {
    const t = k;
    const G = globals(t);
    const SK = skin.joints.map((j, ji) => mmCV(G[j], IBM[ji]));
    const Wb = cn.bones.map(b => { const fr = na.bones[b.name]; return fr ? fr[Math.min(k, fr.length - 1)] : null; });
    const SKgt = cn.bones.map((b, bi) => Wb[bi] ? mmRV(iwt[bi], Wb[bi]) : null);
    const SKn = cn.bones.map((b, bi) => b.name === na2Root ? I4 : SKgt[bi]);
    for (let bi = 0; bi < cn.bones.length; bi++) {
      const bn = cn.bones[bi].name, ji = jointOf[bn];
      if (bn === na2Root || ji === undefined || !SKgt[bi]) continue;
      for (const v of probesOf[bi]) { const a = map(mulRV(v.p, SKgt[bi])), b = mulCV(SK[ji], map(v.p)); const e = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (e > (boneXform[bn] || 0)) boneXform[bn] = e; }
    }
    for (let i = 0; i < P.length; i++) {
      // converted
      let ws = J[i].map((_, q) => Wt[i][q]); const s = ws.reduce((a, b) => a + b, 0); ws = ws.map(x => x / s);
      const vc = [0, 0, 0]; for (let q = 0; q < 4; q++) if (ws[q] > 0) { const r = mulCV(SK[J[i][q]], P[i]); for (let c = 0; c < 3; c++) vc[c] += ws[q] * r[c]; }
      // ground truth
      const m = match[i]; if (m.c < 0 || m.d > 1) continue;
      const cv = cn.verts[m.c];
      const skinGT = SKx => { const vg = [0, 0, 0]; let wsum = 0; for (let q = 0; q < 4; q++) if (cv.w[q] > 0) { const bi = cv.b[q]; if (!SKx[bi]) continue; const r = mulRV(cv.p, SKx[bi]); for (let c = 0; c < 3; c++) vg[c] += cv.w[q] * r[c]; wsum += cv.w[q]; } return map(vg.map(x => x / wsum)); };
      let dom = null, domw = 0; for (let q = 0; q < 4; q++) if (cv.w[q] > domw) { domw = cv.w[q]; dom = cn.bones[cv.b[q]].name; }
      const vgm = skinGT(SKgt);
      const rootOnly = cv.w.every((w, q) => !(w > 0) || cn.bones[cv.b[q]].name === na2Root);
      const vgn = rootOnly ? map(cv.p) : (() => { const vg = [0, 0, 0]; let wsum = 0; for (let q = 0; q < 4; q++) if (cv.w[q] > 0 && cn.bones[cv.b[q]].name !== na2Root && SKgt[cv.b[q]]) { const r = mulRV(cv.p, SKgt[cv.b[q]]); for (let c = 0; c < 3; c++) vg[c] += cv.w[q] * r[c]; wsum += cv.w[q]; } return map(vg.map(x => x / wsum)); })();
      const e = Math.hypot(vgm[0] - vc[0], vgm[1] - vc[1], vgm[2] - vc[2]);
      const en = Math.hypot(vgn[0] - vc[0], vgn[1] - vc[1], vgn[2] - vc[2]);
      errs.push(e); sumE += e; cnt++; errsN.push(en);
      boneErr[dom] = Math.max(boneErr[dom] || 0, e);
      for (let q = 0; q < 4; q++) if (cv.w[q] >= 0.15) { const bn = cn.bones[cv.b[q]].name; boneErrN[bn] = Math.max(boneErrN[bn] || 0, en); }
      if (e > maxE) { maxE = e; worst = { frame: k, vert: i, dom, gt: vgm.map(x => +x.toFixed(2)), conv: vc.map(x => +x.toFixed(2)) }; }
      if (en > maxN) { maxN = en; worstN = { frame: k, vert: i, bones: cv.b.map((b, q) => cv.w[q] > 0 ? cn.bones[b].name + ':' + cv.w[q].toFixed(2) : '').filter(Boolean).join(' '), gt: vgn.map(x => +x.toFixed(2)), conv: vc.map(x => +x.toFixed(2)) }; }
    }
  }
  errs.sort((a, b) => a - b); errsN.sort((a, b) => a - b);
  const p = (arr, q) => arr[Math.floor(q * (arr.length - 1))];
  return {
    verts: P.length, unmatched, frames: nFrames, mean: sumE / cnt, p95: p(errs, 0.95), p99: p(errs, 0.99), max: maxE, worst, boneErr,
    boneXform,
    noroot: { p95: p(errsN, 0.95), p99: p(errsN, 0.99), max: maxN, worst: worstN, boneErr: boneErrN },
  };
}

module.exports = { run, parseCn6, parseNa2 };
if (require.main === module) {
  const [c, na2f, gl, st] = process.argv.slice(2);
  const r = run(c, na2f, gl, st ? +st : 10);
  const be = Object.entries(r.boneErr).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ':' + v.toFixed(2)).join(' ');
  console.log(`verts ${r.verts} unmatched ${r.unmatched} frames ${r.frames} | err mean ${r.mean.toFixed(3)} p95 ${r.p95.toFixed(3)} p99 ${r.p99.toFixed(3)} max ${r.max.toFixed(3)}`);
  console.log('worst', JSON.stringify(r.worst)); console.log('max err by dominant bone:', be);
  const n = r.noroot, ben = Object.entries(n.boneErr).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ':' + v.toFixed(2)).join(' ');
  console.log('per-bone transform error:', Object.entries(r.boneXform).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ':' + v.toFixed(2)).join(' '));
  console.log(`noroot p95 ${n.p95.toFixed(3)} p99 ${n.p99.toFixed(3)} max ${n.max.toFixed(3)}`); console.log('noroot worst', JSON.stringify(n.worst)); console.log('noroot max err by bone (w>=0.15):', ben);
}
