// Mean eye-joint position (mesh space) over an animation, from an rdm4 round-trip glTF (mesh + anim),
// and where it lands in the world under a cfg ORIENTATION_TRANSFORM (rotation/scale of the Orient portraits).
// node eyes.js rt.gltf [Px Py]
const fs = require('fs'), path = require('path');
function eyes(gl) {
  const g = JSON.parse(fs.readFileSync(gl)), bufs = g.buffers.map(b => fs.readFileSync(path.join(path.dirname(gl), b.uri)));
  const acc = i => { const a = g.accessors[i], bv = g.bufferViews[a.bufferView], n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type]; const off = (bv.byteOffset || 0) + (a.byteOffset || 0), buf = bufs[bv.buffer]; const o = []; for (let k = 0; k < a.count; k++) { const e = []; for (let c = 0; c < n; c++) e.push(buf.readFloatLE(off + (k * n + c) * 4)); o.push(n === 1 ? e[0] : e); } return o; };
  const mm = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) C[c * 4 + r] += A[k * 4 + r] * B[c * 4 + k]; return C; };
  const trs = (t, q) => { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, t[0], t[1], t[2], 1]; };
  const parent = {}; g.nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
  const an = {}; let nk = 1;
  for (const ch of (g.animations ? g.animations[0].channels : [])) { const s = g.animations[0].samplers[ch.sampler]; const v = acc(s.output); (an[ch.target.node] = an[ch.target.node] || {})[ch.target.path] = v; nk = Math.max(nk, v.length); }
  const loc = (i, k) => { const n = g.nodes[i], a = an[i] || {}; const pick = (arr, d) => arr ? arr[Math.min(k, arr.length - 1)] : d; return trs(pick(a.translation, n.translation || [0, 0, 0]), pick(a.rotation, n.rotation || [0, 0, 0, 1])); };
  const glob = (i, k) => parent[i] !== undefined ? mm(glob(parent[i], k), loc(i, k)) : loc(i, k);
  // base-game rig: Bone_L_Eye / Bone_R_Eye; the addon's newer rig (Garibaldi, Spy): SkinBone_Eye_Lf / _Rt
  const pair = [['Bone_L_Eye', 'Bone_R_Eye'], ['SkinBone_Eye_Lf', 'SkinBone_Eye_Rt']].find(p => p.every(n => g.nodes.some(x => x.name === n))) || ['Bone_L_Eye', 'Bone_R_Eye'];
  const ids = pair.map(n => g.nodes.findIndex(x => x.name === n));
  if (ids.some(i => i < 0)) throw new Error('no eye bones in ' + gl + ': ' + g.nodes.map(n => n.name).join(' '));
  const mean = [0, 0, 0], rest = [0, 0, 0];
  let zmin = Infinity, zmax = -Infinity;
  for (let k = 0; k < nk; k++) for (const i of ids) { const M = glob(i, k); for (let c = 0; c < 3; c++) mean[c] += M[12 + c] / (nk * 2); const z = M[14]; zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
  // rest (no animation)
  const saved = Object.assign({}, an); for (const k of Object.keys(an)) delete an[k];
  for (const i of ids) { const M = glob(i, 0); for (let c = 0; c < 3; c++) rest[c] += M[12 + c] / 2; }
  // rest-pose eye line (left eye -> right eye) as an angle in the mesh's x/y plane; 180 = square to the camera
  const [L, R] = ids.map(i => glob(i, 0));
  const restEyeYaw = Math.atan2(R[13] - L[13], R[12] - L[12]) * 180 / Math.PI;
  Object.assign(an, saved);
  return { mean, rest, zmin, zmax, frames: nk, restEyeYaw };
}
// world = P + S * R(q) * p with the portrait quaternion; rows of R for world x and y
const S = 0.039572;
const toWorld = (p, Px, Py) => [Px + S * (0.939693 * p[0] + 0.342020 * p[1]), Py - S * p[2]];
module.exports = { eyes, toWorld, S };
if (require.main === module) {
  const [gl, Px, Py] = process.argv.slice(2);
  const e = eyes(gl);
  console.log('eyes mean', e.mean.map(x => x.toFixed(2)).join(' '), 'rest', e.rest.map(x => x.toFixed(2)).join(' '), 'z range', e.zmin.toFixed(1), e.zmax.toFixed(1), 'frames', e.frames);
  if (Px !== undefined) console.log('world (mean) x,y', toWorld(e.mean, +Px, +Py).map(x => x.toFixed(3)).join(' '), ' rest', toWorld(e.rest, +Px, +Py).map(x => x.toFixed(3)).join(' '));
}
