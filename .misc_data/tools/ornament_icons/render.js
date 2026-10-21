// Software renderer for ornament icons: orthographic camera, directional sun with a PCF shadow map, alpha-tested
// textures, ground decals composited under the models, supersampled, then the vanilla-style dark outline.
const { qrot } = require('./scene.js');
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function sample(t, u, v, bilinear = true) {
  u -= Math.floor(u); v -= Math.floor(v);
  const fx = u * t.w - 0.5, fy = v * t.h - 0.5;
  if (!bilinear) {
    const x = Math.min(t.w - 1, Math.max(0, Math.round(fx))), y = Math.min(t.h - 1, Math.max(0, Math.round(fy)));
    const o = (y * t.w + x) * t.ch; return [t.px[o], t.px[o + 1], t.px[o + 2], t.ch === 4 ? t.px[o + 3] : 255];
  }
  const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
  const out = [0, 0, 0, 0];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x = ((x0 + i) % t.w + t.w) % t.w, y = ((y0 + j) % t.h + t.h) % t.h, w = (i ? ax : 1 - ax) * (j ? ay : 1 - ay);
    const o = (y * t.w + x) * t.ch;
    out[0] += t.px[o] * w; out[1] += t.px[o + 1] * w; out[2] += t.px[o + 2] * w; out[3] += (t.ch === 4 ? t.px[o + 3] : 255) * w;
  }
  return out;
}
// clamped sampling for decals (no wrap)
function sampleClamp(t, u, v) {
  if (u < 0 || u > 1 || v < 0 || v > 1) return [0, 0, 0, 0];
  return sample(t, Math.min(u, 0.99999), Math.min(v, 0.99999));
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

function camera(el, az) {
  const E = el * Math.PI / 180, A = az * Math.PI / 180;
  const fwd = [-Math.cos(E) * Math.sin(A), -Math.sin(E), -Math.cos(E) * Math.cos(A)];
  const right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  return { fwd, right, up };
}

// decal quad corners in world space, u along local x, v along local z
const decalFlip = { u: false, v: false, swap: false };
function decalTris(d) {
  const { apply } = require('./scene.js');
  const c = [[-d.hx, -d.hz], [d.hx, -d.hz], [d.hx, d.hz], [-d.hx, d.hz]].map(([x, z]) => apply(d.T, [x, 0, z]));
  let uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const fu = d.flipU ?? decalFlip.u, fv = d.flipV ?? decalFlip.v, sw = d.swap ?? decalFlip.swap;
  uv = uv.map(([u, v]) => { if (sw) [u, v] = [v, u]; return [fu ? 1 - u : u, fv ? 1 - v : v]; });
  return [{ v: [c[0], c[1], c[2]], uv: [uv[0], uv[1], uv[2]] }, { v: [c[0], c[2], c[3]], uv: [uv[0], uv[2], uv[3]] }];
}

/*
 opts: el, az, mirror (bool: mirror x before projecting), light (toward-light dir), amb, dif, size (128), ss (4),
       alphaRef (0..255), ground: [decal...] drawn first (below scene decals),
       fit: { groundPts: [[x,y,z]...] (footprint outline for the width rule), width: 121, bottom: 124, top: 2, maxW: 124 }
       or view: { k, cx, cy } to reuse a fixed framing
*/
function render(scene, opts) {
  const size = opts.size || 128, SS = opts.ss || 4, R = size * SS;
  const cam = camera(opts.el, opts.az);
  const mx = p => opts.mirror ? [-p[0], p[1], p[2]] : p;
  const M = p => p;
  const L = norm(opts.light || [0.6, 0.6, 0.3]);
  const amb = opts.amb ?? 0.45, dif = opts.dif ?? 0.75, aref = opts.alphaRef ?? 128;
  const groundClip = opts.groundClip ?? -0.01;
  const tris = scene.tris.filter(t => !(Math.max(t.v[0][1], t.v[1][1], t.v[2][1]) < groundClip)).map(t => opts.mirror ? { ...t, v: t.v.map(mx), n: t.n && t.n.map(mx) } : t);
  const decals = [...(opts.ground || []), ...(scene.decals || [])].flatMap(d => decalTris(d).map(t => ({ ...t, v: t.v.map(mx), tex: d.tex, mul: d.mul, sampler: d.sampler })));
  const sprites = (scene.sprites || []).filter(s => s.p[1] >= groundClip).map(s => ({ ...s, p: mx(s.p) }));

  // ---------- framing ----------
  const sx_ = p => dot(M(p), cam.right), sy_ = p => dot(M(p), cam.up);
  let view = opts.view;
  if (!view) {
    const f = opts.fit || {};
    const width = f.width ?? 121, bottom = f.bottom ?? 124, top = f.top ?? 2, maxW = f.maxW ?? 124;
    const gp = f.groundPts || decals.flatMap(t => t.v);
    const gx = gp.map(sx_), gy = gp.map(sy_);
    let k = width / (Math.max(...gx) - Math.min(...gx));
    // everything visible
    const all = [...tris.flatMap(t => t.v), ...gp, ...sprites.map(s => s.p)];
    const ax = all.map(sx_), ay = all.map(sy_);
    const minX = Math.min(...ax), maxX = Math.max(...ax), minY = Math.min(...ay), maxY = Math.max(...ay);
    k = Math.min(k, maxW / (maxX - minX), (bottom - top) / (maxY - minY));
    const cx = (Math.min(...gx) + Math.max(...gx)) / 2;
    view = { k, cx, bottomY: minY, bottom };
  }
  const proj = p => { const q = M(p); return [(size / 2 + (dot(q, cam.right) - view.cx) * view.k) * SS, (view.bottom - (dot(q, cam.up) - view.bottomY) * view.k) * SS, dot(q, cam.fwd)]; };

  // ---------- shadow maps (sun + sky hemisphere for occlusion) ----------
  const allPts = [...tris.flatMap(t => t.v), ...decals.flatMap(t => t.v)];
  function makeSM(Ld, SM) {
    const lf = Ld.map(x => -x), lr = norm(Math.abs(lf[1]) > 0.99 ? cross(lf, [1, 0, 0]) : cross(lf, [0, 1, 0])), lu = cross(lr, lf);
    const lp = p => [dot(p, lr), dot(p, lu), dot(p, lf)];
    const pts = allPts.map(lp);
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of pts) { a0 = Math.min(a0, p[0]); a1 = Math.max(a1, p[0]); b0 = Math.min(b0, p[1]); b1 = Math.max(b1, p[1]); }
    const ls = (SM - 4) / Math.max(a1 - a0, b1 - b0, 1e-6);
    const toSM = p => { const q = lp(p); return [2 + (q[0] - a0) * ls, 2 + (q[1] - b0) * ls, q[2]]; };
    const depth = new Float32Array(SM * SM).fill(Infinity);
    for (const t of tris) {
      const [a, b, c] = t.v.map(toSM);
      const tex = t.mat.tex;
      raster(a, b, c, SM, SM, (x, y, w0, w1, w2) => {
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
        if (z >= depth[y * SM + x]) return;
        if (tex && t.uv && tex.ch === 4) {
          const u = w0 * t.uv[0][0] + w1 * t.uv[1][0] + w2 * t.uv[2][0], v = w0 * t.uv[0][1] + w1 * t.uv[1][1] + w2 * t.uv[2][1];
          if (sample(tex, u, v, false)[3] < aref) return;
        }
        depth[y * SM + x] = z;
      });
    }
    const bias = (opts.shadowBias ?? 0.02);
    return (p, r) => {
      const [x, y, z] = toSM(p);
      let lit = 0, n = 0;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const xi = Math.floor(x) + i, yi = Math.floor(y) + j;
        n++;
        if (xi < 0 || yi < 0 || xi >= SM || yi >= SM) { lit++; continue; }
        if (z - bias <= depth[yi * SM + xi]) lit++;
      }
      return lit / n;
    };
  }
  const sun = makeSM(L, opts.smSize || 2048);
  const aoN = opts.aoDirs ?? 0, aoDirs = [], aoMaps = [];
  for (let i = 0; i < aoN; i++) {
    // golden-spiral directions on the upper hemisphere (cosine weighted)
    const u = (i + 0.5) / aoN, phi = i * 2.399963, r = Math.sqrt(u), d = [r * Math.cos(phi), Math.sqrt(1 - u), r * Math.sin(phi)];
    aoDirs.push(d); aoMaps.push(makeSM(d, opts.aoSize || 384));
  }
  const sunC = opts.sunColor || [1, 1, 1], skyC = opts.skyColor || [1, 1, 1];
  const light = (n, p) => {
    const nl = Math.max(0, dot(n, L));
    const s = nl > 0 ? sun(p, opts.pcf ?? 2) : 0;
    let ao = 1;
    if (aoN) { let w = 0, v = 0; for (let i = 0; i < aoN; i++) { const c = dot(n, aoDirs[i]); if (c <= 0) continue; w += c; v += c * aoMaps[i](p, 0); } ao = w ? v / w : 1; ao = 1 - (opts.aoStrength ?? 1) * (1 - ao); }
    return [0, 1, 2].map(k => sunC[k] * dif * nl * s + skyC[k] * amb * ao);
  };

  // ---------- model pass (deferred) ----------
  const zb = new Float32Array(R * R).fill(Infinity);
  const alb = new Float32Array(R * R * 3), nrm = new Float32Array(R * R * 3), pos = new Float32Array(R * R * 3), emis = new Uint8Array(R * R);
  const waterTris = [];
  for (const t of tris) {
    if (t.mat.water && !(t.mat.tex && t.uv)) { waterTris.push(t); continue; }
    const P = t.v.map(proj);
    const fn = norm(cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0])));
    const tex = t.mat.tex, mc = t.mat.color;
    raster(P[0], P[1], P[2], R, R, (x, y, w0, w1, w2) => {
      const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2];
      const i = y * R + x;
      if (z >= zb[i]) return;
      if (w0 * t.v[0][1] + w1 * t.v[1][1] + w2 * t.v[2][1] < groundClip) return; // below the terrain: hidden in game
      let c = [200, 200, 200, 255];
      if (tex && t.uv) {
        const u = w0 * t.uv[0][0] + w1 * t.uv[1][0] + w2 * t.uv[2][0], v = w0 * t.uv[0][1] + w1 * t.uv[1][1] + w2 * t.uv[2][1];
        c = sample(tex, u, v);
        if (tex.ch === 4 && c[3] < aref) return;
      } else if (t.mat.water) c = opts.waterColor || [38, 48, 58, 255];
      let n = t.n ? norm([0, 1, 2].map(k => w0 * t.n[0][k] + w1 * t.n[1][k] + w2 * t.n[2][k])) : fn;
      if (dot(n, cam.fwd) > 0) n = n.map(x => -x); // seen from behind (two-sided planes)
      zb[i] = z;
      const tint = t.mat.water && !(tex && t.uv) ? [1, 1, 1] : mc;
      for (let k = 0; k < 3; k++) { alb[i * 3 + k] = c[k] * tint[k]; nrm[i * 3 + k] = n[k]; pos[i * 3 + k] = w0 * t.v[0][k] + w1 * t.v[1][k] + w2 * t.v[2][k]; }
    });
  }
  const col = new Float32Array(R * R * 3);
  for (let i = 0; i < R * R; i++) {
    if (zb[i] === Infinity) continue;
    const l = light([nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]], [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    for (let k = 0; k < 3; k++) col[i * 3 + k] = alb[i * 3 + k] * l[k];
  }
  // ---------- ground pass (decals in order, alpha blended, under models) ----------
  const gcol = new Float32Array(R * R * 3), ga = new Float32Array(R * R), gz = new Float32Array(R * R).fill(Infinity), gpos = new Float32Array(R * R * 3);
  for (const t of decals) {
    const P = t.v.map(proj);
    raster(P[0], P[1], P[2], R, R, (x, y, w0, w1, w2) => {
      const u = w0 * t.uv[0][0] + w1 * t.uv[1][0] + w2 * t.uv[2][0], v = w0 * t.uv[0][1] + w1 * t.uv[1][1] + w2 * t.uv[2][1];
      const c = t.sampler ? t.sampler(u, v) : sampleClamp(t.tex, u, v);
      const a = c[3] / 255;
      if (a <= 0) return;
      const i = y * R + x, m = t.mul || [1, 1, 1];
      for (let k = 0; k < 3; k++) { gcol[i * 3 + k] = gcol[i * 3 + k] * (1 - a) + c[k] * m[k] * a; gpos[i * 3 + k] = w0 * t.v[0][k] + w1 * t.v[1][k] + w2 * t.v[2][k]; }
      ga[i] = ga[i] * (1 - a) + a;
      gz[i] = Math.min(gz[i], w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2]);
    });
  }
  for (let i = 0; i < R * R; i++) {
    if (!ga[i]) continue;
    const l = light([0, 1, 0], [gpos[i * 3], gpos[i * 3 + 1], gpos[i * 3 + 2]]);
    for (let k = 0; k < 3; k++) gcol[i * 3 + k] *= l[k];
  }
  // ---------- composite at SS resolution ----------
  const img = new Float32Array(R * R * 4);
  for (let i = 0; i < R * R; i++) {
    const hasM = zb[i] < Infinity;
    if (hasM && zb[i] <= gz[i] + 1e-4) { img[i * 4] = col[i * 3]; img[i * 4 + 1] = col[i * 3 + 1]; img[i * 4 + 2] = col[i * 3 + 2]; img[i * 4 + 3] = 1; }
    else if (ga[i] > 0) {
      const a = ga[i];
      // ground color is premultiplied-ish accumulation over transparent; un-premultiply
      const gc = [gcol[i * 3] / a, gcol[i * 3 + 1] / a, gcol[i * 3 + 2] / a];
      if (hasM) { for (let k = 0; k < 3; k++) img[i * 4 + k] = gc[k] * a + col[i * 3 + k] * (1 - a); img[i * 4 + 3] = 1; }
      else { for (let k = 0; k < 3; k++) img[i * 4 + k] = gc[k]; img[i * 4 + 3] = a; }
    } else if (hasM) { img[i * 4] = col[i * 3]; img[i * 4 + 1] = col[i * 3 + 1]; img[i * 4 + 2] = col[i * 3 + 2]; img[i * 4 + 3] = 1; }
  }
  // ---------- translucent water (shader 7 without texture) ----------
  const wFlat = opts.waterColor || [40, 62, 72], wFall = [120, 135, 140];
  for (const t of waterTris) {
    const P = t.v.map(proj);
    const fn = norm(cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0])));
    raster(P[0], P[1], P[2], R, R, (x, y, w0, w1, w2) => {
      const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2], i = y * R + x;
      if (z >= zb[i] || (ga[i] > 0.5 && z >= gz[i])) return;
      if (w0 * t.v[0][1] + w1 * t.v[1][1] + w2 * t.v[2][1] < groundClip) return;
      let n = t.n ? norm([0, 1, 2].map(k => w0 * t.n[0][k] + w1 * t.n[1][k] + w2 * t.n[2][k])) : fn;
      if (dot(n, cam.fwd) > 0) n = n.map(v => -v);
      const l = light(n, [0, 1, 2].map(k => w0 * t.v[0][k] + w1 * t.v[1][k] + w2 * t.v[2][k]));
      const steep = Math.abs(n[1]) < 0.7, wc = steep ? wFall : wFlat, a = steep ? 0.18 : 0.85;
      for (let k = 0; k < 3; k++) img[i * 4 + k] = img[i * 4 + 3] > 0 ? img[i * 4 + k] * (1 - a) + wc[k] * l[k] * a : wc[k] * l[k];
      img[i * 4 + 3] = img[i * 4 + 3] + a * (1 - img[i * 4 + 3]);
    });
  }
  // ---------- particles: soft camera-facing discs, back to front, lit like ground ----------
  // a full disc covers more than the sparse particle textures do: particleSize / particleAlpha thin it out,
  // particleTint offsets the warm tone curve (water spray would turn cream)
  const pTint = opts.particleTint || [1, 1, 1], pSize = opts.particleSize ?? 1, pAlpha = opts.particleAlpha ?? 1;
  for (const s of sprites.map(s => ({ ...s, P: proj(s.p) })).sort((a, b) => b.P[2] - a.P[2])) {
    const [cx, cy, z] = s.P, rad = s.r * pSize * view.k * SS, l = light([0, 1, 0], s.p).map((v, k) => v * pTint[k]);
    for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(R - 1, Math.ceil(cy + rad)); y++)
      for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(R - 1, Math.ceil(cx + rad)); x++) {
        const d2 = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / (rad * rad), i = y * R + x;
        if (d2 >= 1 || z >= zb[i] || (ga[i] > 0.5 && z >= gz[i])) continue;
        const a = s.a * pAlpha * (1 - d2) * (1 - d2);
        for (let k = 0; k < 3; k++) img[i * 4 + k] = img[i * 4 + 3] > 0 ? img[i * 4 + k] * (1 - a) + s.c[k] * l[k] * a : s.c[k] * l[k];
        img[i * 4 + 3] += a * (1 - img[i * 4 + 3]);
      }
  }
  // downsample
  const out = new Float32Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) { const o = ((y * SS + j) * R + x * SS + i) * 4; const w = img[o + 3]; r += img[o] * w; g += img[o + 1] * w; b += img[o + 2] * w; a += w; }
    const o = (y * size + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a / (SS * SS); }
  }
  return { img: out, size, view };
}

// vanilla icon outline: 1 px dark ring + soft dark halo, under the image
function outline(img, size, o = {}) {
  const col = o.color || [22, 19, 24];
  const A = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) A[i] = img[i * 4 + 3];
  const R = o.radius ?? 3.5, core = o.core ?? 1.2, coreA = o.coreA ?? 0.9, haloA = o.haloA ?? 0.5;
  const out = new Float32Array(img);
  const rr = Math.ceil(R);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let best = 0;
    for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) {
      const xx = x + i, yy = y + j;
      if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
      const a = A[yy * size + xx];
      if (a <= 0) continue;
      const d = Math.hypot(i, j);
      if (d > R) continue;
      const f = d <= core ? coreA : haloA * Math.pow(1 - (d - core) / (R - core), 1.5);
      best = Math.max(best, a * f);
    }
    const o4 = (y * size + x) * 4, a = img[o4 + 3];
    // image over outline
    const oa = best * (1 - a), na = a + oa;
    if (na <= 0) continue;
    for (let k = 0; k < 3; k++) out[o4 + k] = (img[o4 + k] * a + col[k] * oa) / na;
    out[o4 + 3] = na;
  }
  return out;
}

function toPng(file, img, size, post) {
  const { encode } = require('./png.js');
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    let c = [img[i * 4], img[i * 4 + 1], img[i * 4 + 2]];
    if (post) c = post(c);
    for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.max(0, Math.min(255, Math.round(c[k])));
    px[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(img[i * 4 + 3] * 255)));
  }
  encode(file, size, size, 4, px);
}
module.exports = { render, outline, toPng, camera, decalFlip };
