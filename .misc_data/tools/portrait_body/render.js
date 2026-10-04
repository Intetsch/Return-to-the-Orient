// glTF loader + software rasterizer for previewing portrait meshes.
const fs = require('fs');
const path = require('path');
const PNG = require('./png');

function loadGltf(file) {
  const g = JSON.parse(fs.readFileSync(file));
  const dir = path.dirname(file);
  const bufs = g.buffers.map(b => fs.readFileSync(path.join(dir, b.uri)));
  const acc = i => {
    const a = g.accessors[i], bv = g.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    const buf = bufs[bv.buffer], off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = [];
    for (let k = 0; k < a.count; k++) {
      const e = [];
      for (let c = 0; c < n; c++) {
        if (a.componentType === 5126) e.push(buf.readFloatLE(off + (k * n + c) * 4));
        else if (a.componentType === 5123) e.push(buf.readUInt16LE(off + (k * n + c) * 2));
        else if (a.componentType === 5125) e.push(buf.readUInt32LE(off + (k * n + c) * 4));
        else if (a.componentType === 5121) e.push(buf[off + k * n + c]);
      }
      out.push(n === 1 ? e[0] : e);
    }
    return out;
  };
  const prim = g.meshes[0].primitives[0], at = prim.attributes;
  return {
    g,
    pos: acc(at.POSITION), nrm: acc(at.NORMAL), uv: acc(at.TEXCOORD_0),
    tan: at.TANGENT !== undefined ? acc(at.TANGENT) : null,
    joints: at.JOINTS_0 !== undefined ? acc(at.JOINTS_0) : null,
    weights: at.WEIGHTS_0 !== undefined ? acc(at.WEIGHTS_0) : null,
    idx: acc(prim.indices),
  };
}

// meshes: [{pos, nrm, uv, idx, tex:{w,h,data}, tint?}]
// cam: {yaw (deg), pitch (deg), center [x,y,z], scale (px per unit), w, h}
function render(meshes, cam, out) {
  const W = cam.w, H = cam.h;
  const img = PNG.create(W, H, cam.bg || [60, 60, 70, 255]);
  const zb = new Float32Array(W * H).fill(-Infinity);
  const yaw = cam.yaw * Math.PI / 180, pitch = (cam.pitch || 0) * Math.PI / 180;
  // mesh space: +z down, -y towards viewer at yaw 0, x right(viewer's left?)
  const proj = p => {
    let x = p[0] - cam.center[0], y = p[1] - cam.center[1], z = p[2] - cam.center[2];
    // yaw around z axis
    const cx = Math.cos(yaw) * x - Math.sin(yaw) * y, cy = Math.sin(yaw) * x + Math.cos(yaw) * y;
    // pitch around x axis
    const py = Math.cos(pitch) * cy - Math.sin(pitch) * z, pz = Math.sin(pitch) * cy + Math.cos(pitch) * z;
    // screen: x right = -cx (mirror so that figure's right is screen left), y down = pz, depth = -py (towards viewer bigger)
    return [W / 2 + (cam.mirror ? -cx : cx) * cam.scale, H / 2 + pz * cam.scale, -py];
  };
  const rot = n => {
    const cx = Math.cos(yaw) * n[0] - Math.sin(yaw) * n[1], cy = Math.sin(yaw) * n[0] + Math.cos(yaw) * n[1];
    const py = Math.cos(pitch) * cy - Math.sin(pitch) * n[2], pz = Math.sin(pitch) * cy + Math.cos(pitch) * n[2];
    return [cam.mirror ? -cx : cx, pz, -py];
  };
  const L = (() => { const l = [-0.4, -0.5, 0.75]; const s = Math.hypot(...l); return l.map(v => v / s); })();
  for (const m of meshes) {
    const sp = m.pos.map(proj), sn = m.nrm.map(rot);
    const tex = m.tex;
    for (let t = 0; t < m.idx.length; t += 3) {
      const a = m.idx[t], b = m.idx[t + 1], c = m.idx[t + 2];
      const A = sp[a], B = sp[b], C = sp[c];
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (Math.abs(area) < 1e-9) continue;
      if (cam.cull && (cam.mirror ? -area : area) * cam.cull < 0) continue;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
        const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
        const o = y * W + x;
        if (z <= zb[o]) continue;
        zb[o] = z;
        let n = [0, 1, 2].map(k => w0 * sn[a][k] + w1 * sn[b][k] + w2 * sn[c][k]);
        const nl = Math.hypot(...n) || 1; n = n.map(v => v / nl);
        if (n[2] < 0 && !cam.noBackfaceTint) n = n.map(v => -v);
        let col = m.color || [200, 200, 200];
        if (tex && !cam.flat) {
          let u = w0 * m.uv[a][0] + w1 * m.uv[b][0] + w2 * m.uv[c][0];
          let v = w0 * m.uv[a][1] + w1 * m.uv[b][1] + w2 * m.uv[c][1];
          u = u - Math.floor(u); v = v - Math.floor(v);
          const tx = Math.min(tex.w - 1, Math.floor(u * tex.w)), ty = Math.min(tex.h - 1, Math.floor(v * tex.h));
          const q = (ty * tex.w + tx) * 4;
          col = [tex.data[q], tex.data[q + 1], tex.data[q + 2]];
        }
        let d = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        const sh = cam.unlit ? 1 : 0.45 + 0.75 * d;
        if (m.tint && cam.showTint) col = col.map((v, k) => v * 0.5 + m.tint[k] * 0.5);
        img.data[o * 4] = Math.min(255, col[0] * sh);
        img.data[o * 4 + 1] = Math.min(255, col[1] * sh);
        img.data[o * 4 + 2] = Math.min(255, col[2] * sh);
      }
    }
  }
  if (cam.marks) for (const mk of cam.marks) {
    const P = proj(mk.p), r = mk.r || 2;
    for (let y = Math.round(P[1]) - r; y <= Math.round(P[1]) + r; y++) for (let x = Math.round(P[0]) - r; x <= Math.round(P[0]) + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      img.data.set(mk.c, (y * W + x) * 4);
    }
  }
  PNG.encode(out, img, false);
}

module.exports = { loadGltf, render };
