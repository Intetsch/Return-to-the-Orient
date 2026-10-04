// Renders a 256x256 player-portrait picker tile (RGBA, transparent background) from a bust + body,
// framed like the vanilla profile icons: head near the top, shoulders filling the width, cut at the chest.
// Supersampled 4x with bilinear texture lookups.
const PNG = require('./png');
const { loadGltf } = require('./render');

function bilerp(tex, u, v) {
  u = u - Math.floor(u); v = v - Math.floor(v);
  const x = u * tex.w - 0.5, y = v * tex.h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const g = (xx, yy) => { xx = (xx + tex.w) % tex.w; yy = Math.max(0, Math.min(tex.h - 1, yy)); const o = (yy * tex.w + xx) * 4; return [tex.data[o], tex.data[o + 1], tex.data[o + 2]]; };
  const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
  return [0, 1, 2].map(k => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy);
}

function renderIcon(meshes, cam, out) {
  const SS = 4, N = 256, W = N * SS;
  const col = new Float32Array(W * W * 3), cov = new Uint8Array(W * W), zb = new Float32Array(W * W).fill(-Infinity);
  const yaw = cam.yaw * Math.PI / 180, pitch = (cam.pitch || 0) * Math.PI / 180, scale = cam.scale * SS;
  const view = p => { // mesh space (+z down, -y front) -> screen x right, y down, depth towards viewer
    const x = p[0] - cam.center[0], y = p[1] - cam.center[1], z = p[2] - cam.center[2];
    const cx = Math.cos(yaw) * x - Math.sin(yaw) * y, cy = Math.sin(yaw) * x + Math.cos(yaw) * y;
    const py = Math.cos(pitch) * cy - Math.sin(pitch) * z, pz = Math.sin(pitch) * cy + Math.cos(pitch) * z;
    return [-cx, pz, -py];
  };
  const L1 = norm([-0.45, -0.55, 0.7]), L2 = norm([0.6, -0.1, 0.5]);
  function norm(v) { const l = Math.hypot(...v); return v.map(x => x / l); }
  for (const m of meshes) {
    const sp = m.pos.map(p => { const v = view(p); return [W / 2 + v[0] * scale, W / 2 + v[1] * scale, v[2]]; });
    const sn = m.nrm.map(n => { const v = view([n[0] + cam.center[0], n[1] + cam.center[1], n[2] + cam.center[2]]); return norm(v); });
    for (let t = 0; t < m.idx.length; t += 3) {
      const a = m.idx[t], b = m.idx[t + 1], c = m.idx[t + 2], A = sp[a], B = sp[b], C = sp[c];
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(W - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
        const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * A[2] + w1 * B[2] + w2 * C[2], o = y * W + x;
        if (z <= zb[o]) continue;
        zb[o] = z;
        let n = norm([0, 1, 2].map(k => w0 * sn[a][k] + w1 * sn[b][k] + w2 * sn[c][k]));
        if (n[2] < 0) n = n.map(v => -v); // open shells: light the inside like the outside
        const u = w0 * m.uv[a][0] + w1 * m.uv[b][0] + w2 * m.uv[c][0], v = w0 * m.uv[a][1] + w1 * m.uv[b][1] + w2 * m.uv[c][1];
        const tc = bilerp(m.tex, u, v);
        const d1 = Math.max(0, n[0] * L1[0] + n[1] * L1[1] + n[2] * L1[2]), d2 = Math.max(0, n[0] * L2[0] + n[1] * L2[1] + n[2] * L2[2]);
        const sh = 0.5 + 0.62 * d1 + 0.18 * d2;
        for (let k = 0; k < 3; k++) col[o * 3 + k] = tc[k] * sh * (k === 0 ? 1.03 : k === 2 ? 0.97 : 1); // slightly warm, like the game light
        cov[o] = 1;
      }
    }
  }
  // downsample: colour averaged over covered samples, alpha = coverage
  const img = PNG.create(N, N, [0, 0, 0, 0]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) { const o = (y * SS + sy) * W + x * SS + sx; if (!cov[o]) continue; r += col[o * 3]; g += col[o * 3 + 1]; b += col[o * 3 + 2]; n++; }
    const q = (y * N + x) * 4;
    if (n) { img.data[q] = Math.min(255, r / n); img.data[q + 1] = Math.min(255, g / n); img.data[q + 2] = Math.min(255, b / n); img.data[q + 3] = Math.round(255 * n / (SS * SS)); }
  }
  // bleed colour into transparent texels so the mips do not fringe dark
  for (let pass = 0; pass < 8; pass++) {
    const add = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const q = (y * N + x) * 4; if (img.data[q + 3] || img.data[q] || img.data[q + 1] || img.data[q + 2]) continue;
      const acc = [0, 0, 0]; let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const qq = (yy * N + xx) * 4; if (!(img.data[qq] || img.data[qq + 1] || img.data[qq + 2])) continue; for (let k = 0; k < 3; k++) acc[k] += img.data[qq + k]; n++; }
      if (n) add.push([q, acc.map(v => v / n)]);
    }
    for (const [q, c] of add) { img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; }
  }
  PNG.encode(out, img, true);
}

if (require.main === module) {
  // [tier, output name, yaw, top of head z, bottom z]
  const JOBS = [['01', 'orient_portrait_nomad', -14, -136, 26], ['02', 'orient_portrait_envoy', -14, -162, 8]];
  for (const [t, name, yaw, ztop, zbot] of JOBS) {
    const bust = loadGltf(`g${t}/out.gltf`); bust.tex = PNG.decode(`tex/resident_orient_tier${t}_diff_0.png`);
    const body = loadGltf(`body${t}/body.gltf`); body.tex = PNG.decode(`body${t}/body_diff.png`);
    const scale = 256 / (zbot - ztop);
    renderIcon([bust, body], { yaw, pitch: 0, center: [0, 10, (ztop + zbot) / 2], scale }, `${name}.png`);
    console.log('wrote', `${name}.png`);
  }
}
module.exports = { renderIcon };
