// Source sampling: the Incense Workshop's L wall (n_toolmakers_workshop_lod0, back-left corner) and its atlas maps.
// rect(name) gives a sampler (s, t) -> [diff rgba, norm rgba, metal rgba] through the source mesh's own UVs.
const T = require('path').join(__dirname, '../ornament_icons/');
const { makeResolver } = require(T + 'scene.js');
const MOD = require('path').resolve(__dirname, '../../..');
const R = makeResolver(MOD);
const DIR = 'data/graphics/buildings/orient/sbm/iaam/orient/004handwerk/schmied/';
const mesh = R.mesh(DIR + 'rdm/n_toolmakers_workshop_lod0.rdm')[0];
const MAPS = ['maps/s_toolmakers_workshop_diff.png', 'maps/n_toolmakers_workshop_norm.png', 'maps/n_toolmakers_workshop_metal.png'].map(m => R.texture(DIR + m));
const tri = i => [0, 1, 2].map(k => { const v = mesh.idx[i * 3 + k]; return { p: mesh.pos[v], uv: mesh.uv[v] }; });
// faces of the L wall, by triangle index (see dumpcomp.js)
const FACES = { outerX: [54, 55], outerZ: [58, 59], topX: [52, 53], topZ: [56, 57], innerX: [50, 51], innerZ: [48, 49] };
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// uv of a 3D point on one of the given triangles (closest by barycentric clamp)
function uvAt(tris, p) {
  let best = null;
  for (const ti of tris) {
    const [A, B, C] = tri(ti), e1 = sub(B.p, A.p), e2 = sub(C.p, A.p), n = cross(e1, e2), d = sub(p, A.p);
    const nn = dot(n, n), b1 = dot(cross(d, e2), n) / nn, b2 = dot(cross(e1, d), n) / nn, b0 = 1 - b1 - b2;
    const out = Math.max(0, -b0) + Math.max(0, -b1) + Math.max(0, -b2);
    if (!best || out < best.out) best = { out, uv: [0, 1].map(k => b0 * A.uv[k] + b1 * B.uv[k] + b2 * C.uv[k]) };
  }
  return best.uv;
}
function bilinear(t, u, v) {
  const fx = u * t.w - 0.5, fy = v * t.h - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0, o = [0, 0, 0, 0];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x = Math.min(t.w - 1, Math.max(0, x0 + i)), y = Math.min(t.h - 1, Math.max(0, y0 + j)), w = (i ? ax : 1 - ax) * (j ? ay : 1 - ay), q = (y * t.w + x) * t.ch;
    for (let k = 0; k < 4; k++) o[k] += (k < t.ch ? t.px[q + k] : 255) * w;
  }
  return o;
}
const sampleUV = uv => MAPS.map(t => bilinear(t, uv[0], uv[1]));
// outer face path: s = 0 at the x-arm's free end (x=-0.841) -> corner (x=-1.493) -> z-arm's free end (z=0.743); y up
const XE = -0.841, XC = -1.493, ZC = 1.491, ZE = 0.743, H = 0.239;
const LX = XE - XC, LZ = ZC - ZE;
function outer(s, y) {
  if (s <= LX) return uvAt(FACES.outerX, [XE - s, y, ZC]);
  return uvAt(FACES.outerZ, [XC, y, ZC - (s - LX)]);
}
// top of the x arm: s along -x from the free end, t across from outer (z=1.491) to inner (z=1.412)
function topX(s, t) { return uvAt(FACES.topX, [-0.912 - s, H, 1.491 - t * 0.0795]); }
// top of the z arm: s along +z from the free end (z=0.749) , t across from outer (x=-1.493) to inner (x=-1.396)
function topZ(s, t) { return uvAt(FACES.topZ, [-1.4925 + t * 0.0965, H, 0.749 + s]); }
module.exports = { outer, topX, topZ, sampleUV, MAPS, LX, LZ, H, uvAt, FACES };
