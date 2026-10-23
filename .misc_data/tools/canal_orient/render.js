// Ortho software renderer for canal previews. World: y up, x/z ground, 1 unit = 1 tile.
const fs = require('fs');
const path = require('path');
const PNG = require('./png.js');

function loadGltf(file) {
  const g = JSON.parse(fs.readFileSync(file));
  const dir = path.dirname(file);
  const bufs = g.buffers.map(b => fs.readFileSync(path.join(dir, b.uri)));
  const acc = i => {
    const a = g.accessors[i], bv = g.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const buf = bufs[bv.buffer], off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = [];
    for (let k = 0; k < a.count; k++) {
      const e = [];
      for (let c = 0; c < n; c++) {
        if (a.componentType === 5126) e.push(buf.readFloatLE(off + (k * n + c) * 4));
        else if (a.componentType === 5123) e.push(buf.readUInt16LE(off + (k * n + c) * 2));
        else if (a.componentType === 5125) e.push(buf.readUInt32LE(off + (k * n + c) * 4));
      }
      out.push(n === 1 ? e[0] : e);
    }
    return out;
  };
  const prim = g.meshes[0].primitives[0], at = prim.attributes;
  return { pos: acc(at.POSITION), nrm: acc(at.NORMAL), uv: acc(at.TEXCOORD_0), idx: acc(prim.indices) };
}

function sample(tex, u, v, wrap) {
  if (wrap) { u -= Math.floor(u); v -= Math.floor(v); }
  else { u = Math.min(1, Math.max(0, u)); v = Math.min(1, Math.max(0, v)); }
  const fx = u * tex.w - 0.5, fy = v * tex.h - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
  const px = x => wrap ? ((x % tex.w) + tex.w) % tex.w : Math.min(tex.w - 1, Math.max(0, x));
  const py = y => wrap ? ((y % tex.h) + tex.h) % tex.h : Math.min(tex.h - 1, Math.max(0, y));
  const out = [0, 0, 0, 0];
  for (const [dx, dy, w] of [[0, 0, (1 - ax) * (1 - ay)], [1, 0, ax * (1 - ay)], [0, 1, (1 - ax) * ay], [1, 1, ax * ay]]) {
    const q = (py(y0 + dy) * tex.w + px(x0 + dx)) * 4;
    for (let k = 0; k < 4; k++) out[k] += tex.data[q + k] * w;
  }
  return out;
}

// items: [{mesh, tex, rot (deg about y), t [x,y,z], s, decal (alpha blend), wrap, uvScale}]
function render(items, cam, out) {
  const SS = cam.ss || 2, W = cam.w * SS, H = cam.h * SS;
  const col = new Float32Array(W * H * 3).fill(0);
  for (let i = 0; i < W * H; i++) col.set(cam.bg || [70, 80, 90], i * 3);
  const zb = new Float32Array(W * H).fill(-Infinity);
  const yaw = cam.yaw * Math.PI / 180, pitch = cam.pitch * Math.PI / 180;
  const view = p => {
    let x = p[0] - cam.center[0], y = p[1] - cam.center[1], z = p[2] - cam.center[2];
    const cx = Math.cos(yaw) * x - Math.sin(yaw) * z, cz = Math.sin(yaw) * x + Math.cos(yaw) * z;
    // pitch: camera looks down; screen y up = y*cos + cz*sin, depth (towards camera) = cz*cos - y*sin... camera on -z side
    const sy = y * Math.cos(pitch) + cz * Math.sin(pitch);
    const d = -cz * Math.cos(pitch) + y * Math.sin(pitch);
    return [W / 2 + cx * cam.scale * SS, H / 2 - sy * cam.scale * SS, d];
  };
  const Lw = (() => { const l = cam.light || [-0.5, 0.8, -0.35]; const s = Math.hypot(...l); return l.map(v => v / s); })();
  // draw opaque first, then decals sorted as given
  const ordered = items.filter(i => !i.decal).concat(items.filter(i => i.decal));
  for (const it of ordered) {
    const r = (it.rot || 0) * Math.PI / 180, s = it.s || 1, t = it.t || [0, 0, 0];
    const xf = p => [Math.cos(r) * p[0] * s + Math.sin(r) * p[2] * s + t[0], p[1] * s + t[1], -Math.sin(r) * p[0] * s + Math.cos(r) * p[2] * s + t[2]];
    const xn = n => [Math.cos(r) * n[0] + Math.sin(r) * n[2], n[1], -Math.sin(r) * n[0] + Math.cos(r) * n[2]];
    const m = it.mesh;
    const wp = m.pos.map(xf), sp = wp.map(view), wn = m.nrm.map(xn);
    for (let k = 0; k < m.idx.length; k += 3) {
      const a = m.idx[k], b = m.idx[k + 1], c = m.idx[k + 2];
      const A = sp[a], B = sp[b], C = sp[c];
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
        const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * A[2] + w1 * B[2] + w2 * C[2] + (it.bias || 0);
        const o = y * W + x;
        if (z <= zb[o]) continue;
        if (it.clip) { const wx = w0 * wp[a][0] + w1 * wp[b][0] + w2 * wp[c][0], wz = w0 * wp[a][2] + w1 * wp[b][2] + w2 * wp[c][2]; if (it.clip(wx, wz)) continue; }
        let u = w0 * m.uv[a][0] + w1 * m.uv[b][0] + w2 * m.uv[c][0];
        let v = w0 * m.uv[a][1] + w1 * m.uv[b][1] + w2 * m.uv[c][1];
        if (it.uvScale) { u *= it.uvScale; v *= it.uvScale; }
        const tc = it.tex ? sample(it.tex, u, v, it.wrap) : [200, 200, 200, 255];
        let alpha = it.decal ? tc[3] / 255 : 1;
        if (!it.decal && it.alphaTest && tc[3] < 128) continue;
        if (alpha <= 0.01) continue;
        let n = [0, 1, 2].map(q => w0 * wn[a][q] + w1 * wn[b][q] + w2 * wn[c][q]);
        const nl = Math.hypot(...n) || 1; n = n.map(q => q / nl);
        const d = Math.max(0, n[0] * Lw[0] + n[1] * Lw[1] + n[2] * Lw[2]);
        const sh = 0.42 + 0.78 * d;
        if (!it.decal) zb[o] = z;
        for (let q = 0; q < 3; q++) col[o * 3 + q] = col[o * 3 + q] * (1 - alpha) + Math.min(255, tc[q] * sh) * alpha;
      }
    }
  }
  const img = PNG.create(cam.w, cam.h);
  for (let y = 0; y < cam.h; y++) for (let x = 0; x < cam.w; x++) {
    const acc = [0, 0, 0];
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const o = ((y * SS + dy) * W + x * SS + dx) * 3; for (let q = 0; q < 3; q++) acc[q] += col[o + q]; }
    for (let q = 0; q < 3; q++) img.data[(y * cam.w + x) * 4 + q] = Math.round(acc[q] / SS / SS);
  }
  PNG.encode(out, img, false);
}

// flat quad on the ground, size sx x sz centred at origin, uv 0..1 (or tiled)
function quad(sx, sz, y = 0, uvx = 1, uvz = 1) {
  return {
    pos: [[-sx / 2, y, -sz / 2], [sx / 2, y, -sz / 2], [sx / 2, y, sz / 2], [-sx / 2, y, sz / 2]],
    nrm: [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]],
    uv: [[0, 0], [uvx, 0], [uvx, uvz], [0, uvz]],
    idx: [0, 1, 2, 0, 2, 3],
  };
}

module.exports = { loadGltf, render, quad };
