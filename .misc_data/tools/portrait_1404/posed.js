// Skins an rdm4 round-trip glTF (mesh + animation) at key k and returns {pos, nrm, uv, idx} in mesh space,
// for icon.js's renderIcon. Also: node posed.js <mod> out.png k rt.gltf tex.png [rt.gltf tex.png ...]
const fs = require('fs'), path = require('path');
function posed(gl, k) {
  const g = JSON.parse(fs.readFileSync(gl)), bufs = g.buffers.map(b => fs.readFileSync(path.join(path.dirname(gl), b.uri)));
  const acc = i => { const a = g.accessors[i], bv = g.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]; const sz = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[a.componentType]; const off = (bv.byteOffset || 0) + (a.byteOffset || 0), buf = bufs[bv.buffer]; const o = []; for (let j = 0; j < a.count; j++) { const e = []; for (let c = 0; c < n; c++) { const p = off + (j * n + c) * sz; e.push(a.componentType === 5126 ? buf.readFloatLE(p) : a.componentType === 5123 ? buf.readUInt16LE(p) : a.componentType === 5125 ? buf.readUInt32LE(p) : buf[p]); } o.push(n === 1 ? e[0] : e); } return o; };
  const mm = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let q = 0; q < 4; q++) C[c * 4 + r] += A[q * 4 + r] * B[c * 4 + q]; return C; };
  const trs = (t, q) => { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, t[0], t[1], t[2], 1]; };
  const parent = {}; g.nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
  const an = {}; for (const ch of (g.animations ? g.animations[0].channels : [])) { const s = g.animations[0].samplers[ch.sampler]; (an[ch.target.node] = an[ch.target.node] || {})[ch.target.path] = acc(s.output); }
  const pick = (arr, d) => arr && k >= 0 ? arr[Math.min(k, arr.length - 1)] : d; // k < 0: rest pose
  const G = {}; const glob = i => G[i] || (G[i] = (() => { const n = g.nodes[i], a = an[i] || {}; const l = trs(pick(a.translation, n.translation || [0, 0, 0]), pick(a.rotation, n.rotation || [0, 0, 0, 1])); return parent[i] !== undefined ? mm(glob(parent[i]), l) : l; })());
  const prim = g.meshes[0].primitives[0], at = prim.attributes;
  const P = acc(at.POSITION), N = acc(at.NORMAL), UV = acc(at.TEXCOORD_0), J = acc(at.JOINTS_0), W = acc(at.WEIGHTS_0), idx = acc(prim.indices);
  const IBM = acc(g.skins[0].inverseBindMatrices), SK = g.skins[0].joints.map((j, ji) => mm(glob(j), IBM[ji]));
  const pos = [], nrm = [];
  for (let i = 0; i < P.length; i++) {
    const ws = W[i], s = ws.reduce((a, b) => a + b, 0) || 1; const p = [0, 0, 0], n = [0, 0, 0];
    for (let q = 0; q < 4; q++) { const w = ws[q] / s; if (!w) continue; const M = SK[J[i][q]]; for (let r = 0; r < 3; r++) { p[r] += w * (M[r] * P[i][0] + M[4 + r] * P[i][1] + M[8 + r] * P[i][2] + M[12 + r]); n[r] += w * (M[r] * N[i][0] + M[4 + r] * N[i][1] + M[8 + r] * N[i][2]); } }
    const l = Math.hypot(...n) || 1; pos.push(p); nrm.push(n.map(x => x / l));
  }
  return { pos, nrm, uv: UV, idx };
}
module.exports = { posed };
