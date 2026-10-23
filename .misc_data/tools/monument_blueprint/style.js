// Turns elevation G-buffers into the three vanilla monument-construction looks (972x544 RGBA, see README):
//   blueprint: faint whitish drawing of the finished monument with a hatched ground line (<name>_00)
//   planned:   sepia ink drawing with a monochrome wash; parts that the previous stage already has are coloured
//   coloured:  ink drawing with a watercolour wash of the model's own colours (<name>_NN_coloured)
const INK = [62, 47, 34], PAPER = [244, 238, 226], SEPIA = [118, 98, 74];

// per supersampled pixel: ink line strength 0..1 (silhouette, depth step, crease, material change, texture detail)
function edges(g, o = {}) {
  const { W, H, zb, nrm, alb, id } = g, N = W * H, e = new Float32Array(N);
  const zT = o.depthStep ?? 0.12, nT = o.crease ?? 0.8, tex = o.texture ?? 0.9;
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = zb[i] === Infinity ? 0 : 0.3 * alb[i * 3] + 0.59 * alb[i * 3 + 1] + 0.11 * alb[i * 3 + 2];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, has = zb[i] !== Infinity;
    let s = 0;
    for (const j of [i + 1, i + W]) {
      const hj = zb[j] !== Infinity;
      if (has !== hj) { s = 1; break; }
      if (!has) continue;
      if (Math.abs(zb[i] - zb[j]) > zT) s = Math.max(s, 1);
      const d = nrm[i * 3] * nrm[j * 3] + nrm[i * 3 + 1] * nrm[j * 3 + 1] + nrm[i * 3 + 2] * nrm[j * 3 + 2];
      if (d < nT) s = Math.max(s, 0.85);
      if (id[i] !== id[j]) s = Math.max(s, 0.6);
    }
    if (has && s < 1) { // texture detail (brick joints, mosaics): Sobel on albedo luminance
      const gx = lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1] - lum[i - W - 1] - 2 * lum[i - 1] - lum[i + W - 1];
      const gy = lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1] - lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1];
      const t = Math.hypot(gx, gy) * tex - 0.35;
      if (t > 0) s = Math.max(s, Math.min(0.55, t));
    }
    e[i] = s;
  }
  // thicken the strong lines by one supersample so they survive the downsample as ~1 px strokes
  const out = new Float32Array(e);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (e[i] < 0.8) continue;
    for (const j of [i - 1, i + 1, i - W, i + W]) out[j] = Math.max(out[j], e[i] * 0.9);
  }
  return out;
}

// shading 0..1 per supersampled pixel: sun + sky, darker towards the bottom of deep recesses is left to the shadow map
function shade(g, i) { return 0.42 + 0.58 * g.sun[i] + 0.08 * Math.max(0, g.nrm[i * 3 + 1]); }

// colour grade of the watercolour wash: lifted towards the paper, a little warmer, softer saturation
function wash(c, s) {
  const lit = c.map(v => Math.min(1, v * (0.55 + 0.75 * s) * 1.25));
  const l = 0.3 * lit[0] + 0.59 * lit[1] + 0.11 * lit[2];
  return lit.map((v, k) => { const sat = l + (v - l) * 1.1; return (sat * 0.78 + 0.22 * PAPER[k] / 255) * 255 * [1.02, 1, 0.94][k]; });
}
function mono(c, s) {
  const l = Math.min(1, (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) * (0.55 + 0.75 * s) * 1.35);
  const t = Math.pow(1 - l, 1.2);
  return PAPER.map((p, k) => p + (SEPIA[k] - p) * t);
}

// hatching for shadowed faces: diagonal lines every 4 output px
const hatch = (x, y, SS) => { const d = ((x + y) / SS) % 4; return d < 0.9 ? 1 : 0; };

/*
 compose(g, mode, o) -> Buffer RGBA at output size
   mode 'blueprint' | 'planned' | 'coloured'; o.prev: G-buffer of the stage before (planned: matching parts coloured)
*/
function compose(g, mode, o = {}) {
  const { W, H, SS, zb, alb } = g, w = W / SS, h = H / SS;
  const e = edges(g, o.edges);
  const prev = o.prev;
  const acc = new Float32Array(w * h * 4); // premultiplied
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, has = zb[i] !== Infinity;
    let col = null, a = 0;
    if (has) {
      const c = [alb[i * 3], alb[i * 3 + 1], alb[i * 3 + 2]], s = shade(g, i);
      let built = false;
      if (mode === 'planned' && prev && prev.zb[i] !== Infinity && Math.abs(prev.zb[i] - zb[i]) < 0.03) {
        const d = Math.abs(prev.alb[i * 3] - c[0]) + Math.abs(prev.alb[i * 3 + 1] - c[1]) + Math.abs(prev.alb[i * 3 + 2] - c[2]);
        built = d < 0.06;
      }
      if (mode === 'blueprint') { col = [246, 244, 240]; a = 0.26; }
      else if (mode === 'coloured' || built) { col = wash(c, s); a = 0.92; }
      else { col = mono(c, s); a = 0.86; }
      if (mode !== 'coloured' && !built && g.sun[i] < 0.05 && hatch(x, y, SS)) { // engraving hatch in the shade
        const ha = mode === 'blueprint' ? 0.12 : 0.22;
        col = col.map((v, k) => v * (1 - ha) + INK[k] * ha);
      }
    }
    // ink over the wash
    const ea = e[i] * (mode === 'blueprint' ? 0.42 : mode === 'coloured' ? 0.72 : 0.85);
    if (ea > 0) {
      const ink = mode === 'blueprint' ? [96, 72, 52] : INK;
      if (a > 0) col = col.map((v, k) => v * (1 - ea) + ink[k] * ea); else col = ink;
      a = a + ea * (1 - a);
    }
    if (!a) continue;
    const q = (((y / SS) | 0) * w + ((x / SS) | 0)) * 4;
    for (let k = 0; k < 3; k++) acc[q + k] += col[k] * a;
    acc[q + 3] += a;
  }
  const n = SS * SS, px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = acc[i * 4 + 3];
    if (!a) continue;
    for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.round(Math.min(255, acc[i * 4 + k] / a));
    px[i * 4 + 3] = Math.round(Math.min(255, a / n * 255));
  }
  return { w, h, px };
}

// ground: a ruled line over the footprint (+ margin) with short diagonal hatching below it, fading out at both ends
function ground(img, x0, x1, gy, mode) {
  const { w, px } = img;
  const put = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= w || y >= img.h) return;
    const i = (y * w + x) * 4, da = px[i + 3] / 255, na = a + da * (1 - a);
    for (let k = 0; k < 3; k++) px[i + k] = Math.round((c[k] * a + px[i + k] * da * (1 - a)) / na);
    px[i + 3] = Math.round(na * 255);
  };
  const ink = mode === 'blueprint' ? [96, 72, 52] : INK, la = mode === 'blueprint' ? 0.5 : 0.8;
  for (let x = x0; x <= x1; x++) {
    const f = Math.min(1, (x - x0) / 60, (x1 - x) / 60);
    put(x, gy, ink, la * f);
    for (let d = 1; d <= 9; d++) if ((x + d) % 5 === 0) put(x, gy + d, ink, la * 0.45 * f * (1 - d / 10));
    if (mode !== 'blueprint') for (let d = 1; d <= 3; d++) put(x, gy + d, [222, 205, 170], 0.5 * f);
  }
}
module.exports = { compose, ground, edges };
