// Rasterise every mesh that uses the canal atlas into atlas space.
// Per texel: cls (1 rim top, 2 wall, 3 floor plane), the canal direction in uv (unit), px per world unit,
// world height and world along-coordinate. Straight pieces are drawn first, so on texels shared by several
// meshes their unambiguous coordinates win; floor planes come last.
const { loadGltf } = require('./render.js');

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };

// meshes: [{name, gltf}]
function uvmap(meshes, N) {
  const isFloor = n => /low_plane|bassin_basic/.test(n);
  const rank = n => isFloor(n) ? 2 : /short|long|end/.test(n) ? 0 : 1;
  meshes = meshes.slice().sort((a, b) => rank(a.name) - rank(b.name));
  const M = {
    N, cls: new Uint8Array(N * N), du: new Float32Array(N * N), dv: new Float32Array(N * N),
    dens: new Float32Array(N * N), wy: new Float32Array(N * N), ws: new Float32Array(N * N),
  };
  const taken = new Uint8Array(N * N);
  for (const { name, gltf } of meshes) {
    const g = loadGltf(gltf);
    const tris = [];
    for (let k = 0; k < g.idx.length; k += 3) {
      const id = [g.idx[k], g.idx[k + 1], g.idx[k + 2]], P = id.map(i => g.pos[i]), T = id.map(i => g.uv[i]);
      const n = norm(cross(sub(P[1], P[0]), sub(P[2], P[0])));
      tris.push({ P, T, n, c: [0, 1, 2].map(q => (P[0][q] + P[1][q] + P[2][q]) / 3) });
    }
    // walls run along their horizontal tangent; rim tops along the tangent of the nearest wall
    const walls = tris.filter(t => Math.abs(t.n[1]) < 0.6);
    for (const w of walls) w.a = norm([-w.n[2], 0, w.n[0]]);
    for (const t of tris) {
      const ny = t.n[1];
      t.cls = isFloor(name) ? 3 : Math.abs(ny) < 0.6 ? 2 : ny > 0 && t.c[1] > -0.05 ? 1 : 3;
      if (!t.a) {
        let best = null, bd = 1e9;
        for (const w of walls) {
          const d = (w.c[0] - t.c[0]) ** 2 + (w.c[2] - t.c[2]) ** 2 + 0.3 * (w.c[1] - t.c[1]) ** 2;
          if (d < bd) { bd = d; best = w; }
        }
        t.a = best ? best.a : [0, 0, 1];
      }
      // uv jacobian J = [dP/du dP/dv]; the uv step for one world unit along a is pinv(J) a
      const e1 = sub(t.P[1], t.P[0]), e2 = sub(t.P[2], t.P[0]);
      const t1 = [t.T[1][0] - t.T[0][0], t.T[1][1] - t.T[0][1]], t2 = [t.T[2][0] - t.T[0][0], t.T[2][1] - t.T[0][1]];
      const det = t1[0] * t2[1] - t1[1] * t2[0];
      if (Math.abs(det) < 1e-12) { t.skip = true; continue; }
      const Ju = [0, 1, 2].map(q => (e1[q] * t2[1] - e2[q] * t1[1]) / det);
      const Jv = [0, 1, 2].map(q => (e2[q] * t1[0] - e1[q] * t2[0]) / det);
      const a11 = dot(Ju, Ju), a12 = dot(Ju, Jv), a22 = dot(Jv, Jv), b1 = dot(Ju, t.a), b2 = dot(Jv, t.a);
      const dd = a11 * a22 - a12 * a12;
      t.duv = [(a22 * b1 - a12 * b2) / dd, (a11 * b2 - a12 * b1) / dd];
    }
    for (const t of tris) {
      if (t.skip) continue;
      const A = t.T.map(p => [p[0] * N, p[1] * N]);
      const ar = (A[1][0] - A[0][0]) * (A[2][1] - A[0][1]) - (A[1][1] - A[0][1]) * (A[2][0] - A[0][0]);
      if (Math.abs(ar) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(A[0][0], A[1][0], A[2][0]))), x1 = Math.min(N - 1, Math.ceil(Math.max(A[0][0], A[1][0], A[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[0][1], A[1][1], A[2][1]))), y1 = Math.min(N - 1, Math.ceil(Math.max(A[0][1], A[1][1], A[2][1])));
      const l = Math.hypot(...t.duv);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const o = y * N + x;
        if (taken[o]) continue;
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((A[1][0] - px) * (A[2][1] - py) - (A[1][1] - py) * (A[2][0] - px)) / ar;
        const w1 = ((A[2][0] - px) * (A[0][1] - py) - (A[2][1] - py) * (A[0][0] - px)) / ar;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const P = [0, 1, 2].map(q => w0 * t.P[0][q] + w1 * t.P[1][q] + w2 * t.P[2][q]);
        taken[o] = 1;
        M.cls[o] = t.cls; M.du[o] = t.duv[0] / l; M.dv[o] = t.duv[1] / l; M.dens[o] = l * N;
        M.wy[o] = P[1]; M.ws[o] = dot(P, t.a);
      }
    }
  }
  return M;
}

module.exports = { uvmap };
