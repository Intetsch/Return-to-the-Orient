// Rest pose with chosen bones (the eyes) set to their mean local rotation over an animation, skinned like posed.js.
// For tiles of busts whose bind pose has the eyeballs turned aside (Lord Northburg): the gaze of the animation.
// tilePose(roundTripGltf, ['Bone_L_Eye', 'Bone_R_Eye']) -> { pos, nrm, uv, idx }
const fs = require('fs'), path = require('path');
function tilePose(gl, names) {
  const g = JSON.parse(fs.readFileSync(gl)), bufs = g.buffers.map(b => fs.readFileSync(path.join(path.dirname(gl), b.uri)));
  const acc = i => { const a = g.accessors[i], bv = g.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]; const sz = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[a.componentType]; const off = (bv.byteOffset || 0) + (a.byteOffset || 0), buf = bufs[bv.buffer]; const o = []; for (let j = 0; j < a.count; j++) { const e = []; for (let c = 0; c < n; c++) { const p = off + (j * n + c) * sz; e.push(a.componentType === 5126 ? buf.readFloatLE(p) : a.componentType === 5123 ? buf.readUInt16LE(p) : a.componentType === 5125 ? buf.readUInt32LE(p) : buf[p]); } o.push(n === 1 ? e[0] : e); } return o; };
  const mm = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let q = 0; q < 4; q++) C[c * 4 + r] += A[q * 4 + r] * B[c * 4 + q]; return C; };
  const trs = (t, q) => { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, t[0], t[1], t[2], 1]; };
  const parent = {}; g.nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
  // mean rotation key of the chosen nodes (sign-aligned quaternion average)
  const meanRot = {};
  for (const ch of g.animations[0].channels) {
    const node = g.nodes[ch.target.node];
    if (ch.target.path !== 'rotation' || !names.includes(node.name)) continue;
    const qs = acc(g.animations[0].samplers[ch.sampler].output), s = [0, 0, 0, 0];
    for (const q of qs) { const sg = q[0] * qs[0][0] + q[1] * qs[0][1] + q[2] * qs[0][2] + q[3] * qs[0][3] < 0 ? -1 : 1; for (let c = 0; c < 4; c++) s[c] += sg * q[c]; }
    const l = Math.hypot(...s); meanRot[ch.target.node] = s.map(x => x / l);
  }
  const G = {}; const glob = i => G[i] || (G[i] = (() => { const n = g.nodes[i]; const l = trs(n.translation || [0, 0, 0], meanRot[i] || n.rotation || [0, 0, 0, 1]); return parent[i] !== undefined ? mm(glob(parent[i]), l) : l; })());
  const prim = g.meshes[0].primitives[0], at = prim.attributes;
  const P = acc(at.POSITION), N = acc(at.NORMAL), UV = acc(at.TEXCOORD_0), J = acc(at.JOINTS_0), W = acc(at.WEIGHTS_0), idx = acc(prim.indices);
  const IBM = acc(g.skins[0].inverseBindMatrices), SK = g.skins[0].joints.map((j, ji) => mm(glob(j), IBM[ji]));
  const pos = [], nrm = [];
  for (let i = 0; i < P.length; i++) {
    const ws = W[i], s = ws.reduce((a, b) => a + b, 0) || 1; const p = [0, 0, 0], n = [0, 0, 0];
    for (let q = 0; q < 4; q++) { const w = ws[q] / s; if (!w) continue; const M = SK[J[i][q]]; for (let r = 0; r < 3; r++) { p[r] += w * (M[r] * P[i][0] + M[4 + r] * P[i][1] + M[8 + r] * P[i][2] + M[12 + r]); n[r] += w * (M[r] * N[i][0] + M[4 + r] * N[i][1] + M[8 + r] * N[i][2]); } }
    const l = Math.hypot(...n) || 1; pos.push(p); nrm.push(n.map(x => x / l));
  }
  return { pos, nrm, uv: UV, idx, eyesFound: Object.keys(meanRot).length };
}
module.exports = { tilePose };
