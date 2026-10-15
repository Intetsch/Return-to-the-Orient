// Stone canal atlas in the style of the noria pool edge: the Enbesa clay becomes grey sandstone, the rim gets coping
// blocks and the walls staggered courses; joints are darkened in the diffuse and carved into the normal map.
const PNG = require('./png.js');
const { rgb2lab, lab2rgb } = require('./lab.js');

const DEFAULTS = {
  L: 0.25,     // block length along the canal (world units, 4 per tile so joints meet at tile seams)
  H: 0.1,      // course height
  top: 0.08,   // rim height = top of the coping course
  jw: 0.006,   // joint half width
  jsoft: 0.006,
  jdark: 0.45, // joint darkening
  depth: 3,    // groove strength in the normal map
  // clay (median Lab 48.5/24.2/34.5) -> stone; the noria pool-edge blocks measure L 54-63, a 2-4, b 15-19
  stoneL: 57, stoneA: 3, stoneB: 16, kL: 0.6,
  vary: 5,     // per-block lightness spread
};

const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function stoneAtlas(d, n, M, opts) {
  const P = Object.assign({}, DEFAULTS, opts), N = M.N;
  const { cls, du, dv, dens, wy, ws } = M;
  const row = o => (o / N) | 0, col = o => o % N;

  // islands: 4-connected texels of one class whose canal direction is the same atlas axis
  const isl = new Int32Array(N * N).fill(-1), axisOf = o => Math.abs(du[o]) >= Math.abs(dv[o]) ? 0 : 1;
  const islands = [];
  for (let s = 0; s < N * N; s++) {
    if ((cls[s] !== 1 && cls[s] !== 2) || isl[s] >= 0) continue;
    const id = islands.length, ax = axisOf(s), c = cls[s], stack = [s], mem = [];
    isl[s] = id;
    while (stack.length) {
      const o = stack.pop(); mem.push(o);
      const x = col(o), y = row(o);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const q = ny * N + nx;
        if (isl[q] >= 0 || cls[q] !== c || axisOf(q) !== ax) continue;
        isl[q] = id; stack.push(q);
      }
    }
    const along = o => ax ? row(o) : col(o), across = o => ax ? col(o) : row(o);
    let sd = 0, dsum = 0;
    for (const o of mem) { sd += ax ? dv[o] : du[o]; dsum += dens[o]; }
    const sign = sd >= 0 ? 1 : -1, ppu = dsum / mem.length;
    // joint phase: circular mean of (world along - atlas along) mod L, so joints sit where the meshes put them
    let cs = 0, sn = 0;
    for (const o of mem) { const ph = (ws[o] - sign * along(o) / ppu) / P.L * 2 * Math.PI; cs += Math.cos(ph); sn += Math.sin(ph); }
    // courses: height fitted against the other atlas axis (sign by regression, offset mod 2H keeps course parity);
    // robust to texels that a mesh at another height also uses
    let mp = 0, my = 0;
    for (const o of mem) { mp += across(o); my += wy[o]; }
    mp /= mem.length; my /= mem.length;
    let cov = 0;
    for (const o of mem) cov += (across(o) - mp) * (wy[o] - my);
    const usign = cov >= 0 ? 1 : -1;
    let cs2 = 0, sn2 = 0;
    for (const o of mem) { const ph = (wy[o] - usign * across(o) / ppu) / (2 * P.H) * 2 * Math.PI; cs2 += Math.cos(ph); sn2 += Math.sin(ph); }
    islands.push({ ax, sign, ppu, usign, phase: Math.atan2(sn, cs) / (2 * Math.PI) * P.L, uphase: Math.atan2(sn2, cs2) / (2 * Math.PI) * 2 * P.H });
  }

  // joints -> height field (-1 in a joint) and a per-block tone
  const height = new Float32Array(N * N), tone = new Float32Array(N * N), done = new Uint8Array(N * N);
  for (let o = 0; o < N * N; o++) {
    if (cls[o] !== 1 && cls[o] !== 2) continue;
    const I = islands[isl[o]], x = col(o), y = row(o);
    const s = I.sign * (I.ax ? y : x) / I.ppu + I.phase;
    const h0 = I.usign * (I.ax ? x : y) / I.ppu + I.uphase;
    const hy = h0 + Math.round((wy[o] - h0) / (2 * P.H)) * 2 * P.H;
    const course = cls[o] === 1 ? 0 : Math.max(0, Math.floor((P.top - hy) / P.H));
    const sc = s / P.L - (course % 2) * 0.5, blk = Math.floor(sc), fr = sc - blk;
    let dist = Math.min(fr, 1 - fr) * P.L;
    if (cls[o] === 2) {
      const fy = Math.min(1, Math.max(0, (P.top - hy) / P.H - course));
      dist = Math.min(dist, (course > 0 || fy > 0.5 ? Math.min(fy, 1 - fy) : 1 - fy) * P.H); // no joint on the rim edge
    }
    const j = 1 - ss(P.jw, P.jw + P.jsoft, dist);
    height[o] = -j;
    tone[o] = (hash(blk + 1000 * isl[o], course * 7 + 3) - 0.5) * 2 * P.vary;
    done[o] = 1;
  }

  const out = PNG.create(N, N), nout = PNG.create(N, N);
  out.data.set(d.data); nout.data.set(n.data);
  for (let o = 0; o < N * N; o++) {
    const p = o * 4;
    let [L, a, b] = rgb2lab(d.data[p], d.data[p + 1], d.data[p + 2]);
    const w = ss(5, 18, a) * ss(8, 22, b); // clay share; the moss band at the waterline keeps its colour
    if (w > 0.001) {
      L = (P.stoneL + (L - 48.5) * P.kL) * w + L * (1 - w);
      a = (P.stoneA + (a - 24.2) * 0.2) * w + a * (1 - w);
      b = (P.stoneB + (b - 34.5) * 0.35) * w + b * (1 - w);
    }
    if (done[o]) {
      const j = -height[o];
      L = (L + tone[o] * (1 - j)) * (1 - P.jdark * j);
      b *= 1 - 0.3 * j;
    }
    out.data.set(lab2rgb(L, a, b), p);
  }
  // normal map stores XY in R/G (B 0, gloss in A); measured on this atlas: R = 127.5 - k dh/du, G = 127.5 - k dh/dv
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const o = y * N + x; if (!done[o]) continue;
    const h = i => done[i] && isl[i] === isl[o] ? height[i] : height[o];
    const gx = (h(o + 1) - h(o - 1)) / 2, gy = (h(o + N) - h(o - N)) / 2, p = o * 4;
    nout.data[p] = Math.max(0, Math.min(255, Math.round(n.data[p] - P.depth * 40 * gx)));
    nout.data[p + 1] = Math.max(0, Math.min(255, Math.round(n.data[p + 1] - P.depth * 40 * gy)));
    nout.data[p + 3] = Math.round(n.data[p + 3] * (1 + 0.35 * height[o])); // joints less glossy
  }
  // bleed into the island padding (never over the floor planes) so filtering and mips don't pick up old texels
  for (let it = 0; it < 8; it++) {
    const nd = new Uint8Array(done);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const o = y * N + x; if (done[o] || cls[o]) continue;
      for (const q of [o + 1, o - 1, o + N, o - N]) if (done[q]) {
        for (let c = 0; c < 4; c++) { out.data[o * 4 + c] = out.data[q * 4 + c]; nout.data[o * 4 + c] = nout.data[q * 4 + c]; }
        nd[o] = 1; break;
      }
    }
    done.set(nd);
  }
  return { diff: out, norm: nout };
}

module.exports = { stoneAtlas, DEFAULTS };
