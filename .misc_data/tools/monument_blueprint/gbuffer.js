// Orthographic elevation G-buffer for a cfg: per supersampled pixel depth, normal, albedo, material id, sun light.
// Scene loading comes from ../ornament_icons/scene.js (cfg tree, rdm via rdm4-bin, textures via texconv, cached).
const { loadScene, IDENT } = require('../ornament_icons/scene.js');
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function sample(t, u, v) {
  u -= Math.floor(u); v -= Math.floor(v);
  const fx = u * t.w - 0.5, fy = v * t.h - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0, o = [0, 0, 0, 0];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x = ((x0 + i) % t.w + t.w) % t.w, y = ((y0 + j) % t.h + t.h) % t.h, w = (i ? ax : 1 - ax) * (j ? ay : 1 - ay), q = (y * t.w + x) * t.ch;
    for (let k = 0; k < 4; k++) o[k] += (k < t.ch ? t.px[q + k] : 255) * w;
  }
  return o;
}
function raster(a, b, c, W, H, cb) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(area) < 1e-12) return;
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area, w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area, w2 = 1 - w0 - w1;
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
    cb(x, y, w0, w1, w2);
  }
}

// opts: az (deg, camera azimuth like the icon renderer), el (deg), mirror (game handedness, default true),
//       W, H (output px), ss, view {k: px per unit, cx: screen x at the image centre, groundY: image row of y = 0},
//       light (toward-sun dir in mirrored world), clipBelow (drop geometry below this y), rotY
function gbuffer(modRoot, cfgRel, o) {
  const rot = o.rotY ? { p: [0, 0, 0], q: [0, Math.sin(o.rotY * Math.PI / 360), 0, Math.cos(o.rotY * Math.PI / 360)], s: [1, 1, 1] } : IDENT;
  const skip = o.skipModel ? new RegExp(o.skipModel, 'i') : null;
  const scene = loadScene(modRoot, cfgRel, rot, { skipModel: skip ? (n, f) => skip.test(n) || skip.test(f) : null });
  const mirror = o.mirror ?? true, clip = o.clipBelow ?? -1e9;
  const mx = p => mirror ? [-p[0], p[1], p[2]] : p;
  const tris = scene.tris.map(t => ({ ...t, v: t.v.map(mx), n: t.n && t.n.map(mx) })).filter(t => Math.max(...t.v.map(v => v[1])) >= clip);
  const E = (o.el ?? 0) * Math.PI / 180, A = (o.az ?? 0) * Math.PI / 180;
  const fwd = [-Math.cos(E) * Math.sin(A), -Math.sin(E), -Math.cos(E) * Math.cos(A)];
  const right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  const SS = o.ss || 3, W = o.W * SS, H = o.H * SS, v = o.view;
  const proj = p => [(o.W / 2 + (dot(p, right) - v.cx) * v.k) * SS, (v.groundY - dot(p, up) * v.k) * SS, dot(p, fwd)];

  // sun shadow map
  const L = norm(o.light || [-0.5, 0.75, 0.45]);
  const lf = L.map(x => -x), lr = norm(cross(lf, [0, 1, 0])), lu = cross(lr, lf);
  const lp = p => [dot(p, lr), dot(p, lu), dot(p, lf)];
  const SM = 3072; let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const t of tris) for (const p of t.v) { const q = lp(p); a0 = Math.min(a0, q[0]); a1 = Math.max(a1, q[0]); b0 = Math.min(b0, q[1]); b1 = Math.max(b1, q[1]); }
  const ls = (SM - 4) / Math.max(a1 - a0, b1 - b0);
  const toSM = p => { const q = lp(p); return [2 + (q[0] - a0) * ls, 2 + (q[1] - b0) * ls, q[2]]; };
  const smz = new Float32Array(SM * SM).fill(Infinity);
  for (const t of tris) {
    const [a, b, c] = t.v.map(toSM), tex = t.mat.tex;
    raster(a, b, c, SM, SM, (x, y, w0, w1, w2) => {
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
      if (z >= smz[y * SM + x]) return;
      if (tex && t.uv && tex.ch === 4 && sample(tex, w0 * t.uv[0][0] + w1 * t.uv[1][0] + w2 * t.uv[2][0], w0 * t.uv[0][1] + w1 * t.uv[1][1] + w2 * t.uv[2][1])[3] < 128) return;
      smz[y * SM + x] = z;
    });
  }
  const shadow = p => {
    const [x, y, z] = toSM(p); let lit = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xi = Math.floor(x) + i, yi = Math.floor(y) + j; n++; if (xi < 0 || yi < 0 || xi >= SM || yi >= SM || z - 0.03 <= smz[yi * SM + xi]) lit++; }
    return lit / n;
  };

  const N = W * H, zb = new Float32Array(N).fill(Infinity), nrm = new Float32Array(N * 3), alb = new Float32Array(N * 3), wy = new Float32Array(N), id = new Int32Array(N).fill(-1);
  const pos = new Float32Array(N * 3);
  const ids = new Map();
  for (const t of tris) {
    if (t.mat.water && !(t.mat.tex && t.uv)) continue;
    if (!ids.has(t.mat)) ids.set(t.mat, ids.size);
    const mid = ids.get(t.mat), P = t.v.map(proj), fn = norm(cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0]))), tex = t.mat.tex, mc = t.mat.color;
    raster(P[0], P[1], P[2], W, H, (x, y, w0, w1, w2) => {
      const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2], i = y * W + x;
      if (z >= zb[i]) return;
      const py = w0 * t.v[0][1] + w1 * t.v[1][1] + w2 * t.v[2][1];
      if (py < clip) return;
      let c = [190, 190, 190, 255];
      if (tex && t.uv) { c = sample(tex, w0 * t.uv[0][0] + w1 * t.uv[1][0] + w2 * t.uv[2][0], w0 * t.uv[0][1] + w1 * t.uv[1][1] + w2 * t.uv[2][1]); if (tex.ch === 4 && c[3] < 128) return; }
      let n = t.n ? norm([0, 1, 2].map(k => w0 * t.n[0][k] + w1 * t.n[1][k] + w2 * t.n[2][k])) : fn;
      if (dot(n, fwd) > 0) n = n.map(x => -x);
      zb[i] = z; wy[i] = py; id[i] = mid;
      for (let k = 0; k < 3; k++) { alb[i * 3 + k] = c[k] * mc[k] / 255; nrm[i * 3 + k] = n[k]; pos[i * 3 + k] = w0 * t.v[0][k] + w1 * t.v[1][k] + w2 * t.v[2][k]; }
    });
  }
  // direct sun (0..1, shadowed) per pixel
  const sun = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (zb[i] === Infinity) continue;
    const n = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]], nl = Math.max(0, dot(n, L));
    sun[i] = nl > 0 ? nl * shadow([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]) : 0;
  }
  return { W, H, SS, zb, nrm, alb, id, sun, wy, scene, fwd, right, up, tris };
}

// screen extent of a cfg's geometry (for framing several stages identically)
function extent(modRoot, cfgRel, o) {
  const rot = o.rotY ? { p: [0, 0, 0], q: [0, Math.sin(o.rotY * Math.PI / 360), 0, Math.cos(o.rotY * Math.PI / 360)], s: [1, 1, 1] } : IDENT;
  const scene = loadScene(modRoot, cfgRel, rot, {});
  const mirror = o.mirror ?? true, E = (o.el ?? 0) * Math.PI / 180, A = (o.az ?? 0) * Math.PI / 180;
  const fwd = [-Math.cos(E) * Math.sin(A), -Math.sin(E), -Math.cos(E) * Math.cos(A)], right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const t of scene.tris) for (let p of t.v) {
    if (mirror) p = [-p[0], p[1], p[2]];
    if (p[1] < (o.clipBelow ?? -1e9)) continue;
    const sx = dot(p, right), sy = dot(p, up);
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  return { x0, x1, y0, y1 };
}
module.exports = { gbuffer, extent };
