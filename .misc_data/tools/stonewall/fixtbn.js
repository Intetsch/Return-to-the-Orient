// rdm4-bin output -> vanilla tangent frame: negate the bitangent (B4b at +16) so B = -dP/dv like vanilla and the
// source wall (rdm4-bin writes T = -dP/du already), and set the 4th byte of N/G/B to the vanilla z-sign flag
// (1 iff z byte < 128). In place; then counts per triangle whether T ~ -dP/du, B ~ -dP/dv and the winding
// agrees with the normal (all must be "ok").
const fs = require('fs');
const { readStruct, half } = require('./rdmio.js');
for (const f of process.argv.slice(2)) {
  const S = readStruct(f), M = S.metas[0], b = S.b, st = M.stride;
  if (st !== 24) throw new Error(f + ': stride ' + st);
  for (let i = 0; i < M.vcount; i++) {
    const v = M.vb + i * st;
    for (let k = 0; k < 3; k++) b[v + 16 + k] = 255 - b[v + 16 + k];
    for (const o of [8, 12, 16]) b[v + o + 3] = b[v + o + 2] < 128 ? 1 : 0;
  }
  fs.writeFileSync(f, b);
  // check
  const P = i => [0, 2, 4].map(o => half(b.readUInt16LE(M.vb + i * st + o)));
  const V3 = (i, o) => [0, 1, 2].map(k => b[M.vb + i * st + o + k] / 255 * 2 - 1);
  const UV = i => [half(b.readUInt16LE(M.vb + i * st + 20)), half(b.readUInt16LE(M.vb + i * st + 22))];
  const I = i => M.isize === 2 ? b.readUInt16LE(M.ib + i * 2) : b.readUInt32LE(M.ib + i * 4);
  const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  let ok = 0, bad = 0;
  for (let t = 0; t < M.icount; t += 3) {
    const [a, c, d] = [I(t), I(t + 1), I(t + 2)], p0 = P(a), u0 = UV(a);
    const e1 = P(c).map((v, k) => v - p0[k]), e2 = P(d).map((v, k) => v - p0[k]);
    const du1 = UV(c)[0] - u0[0], dv1 = UV(c)[1] - u0[1], du2 = UV(d)[0] - u0[0], dv2 = UV(d)[1] - u0[1], r = du1 * dv2 - du2 * dv1;
    const Tu = e1.map((v, k) => (v * dv2 - e2[k] * dv1) / r), Bv = e1.map((v, k) => (e2[k] * du1 - v * du2) / r);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    (dot(Tu, V3(a, 12)) < 0 && dot(Bv, V3(a, 16)) < 0 && dot(n, V3(a, 8)) > 0) ? ok++ : bad++;
  }
  console.log(f.split(/[\\/]/).pop().padEnd(28), 'triangles ok', ok, 'bad', bad);
}
