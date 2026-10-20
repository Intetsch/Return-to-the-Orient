// Vanilla-style ornament icon (128x128) for a cfg: Enbesa camera (elevation 38.5, azimuth 225, game handedness),
// sun from the screen right (shadows fall left), sky occlusion, Africa-ornament sand ground under the footprint,
// colour grade fitted to the vanilla Africa ornament icons, dark outline. Framing like the Africa icons: visible
// width 120 px, bottom edge on row 124, shrunk to fit when tall.
// Usage: node icon.js <modRoot> <cfg rel> <out.png> [jsonOptions]
//   options: footprint [hx,hz] (else from the .ifo BuildBlocker), noGround, skipModel regex, rotY (deg), width, extraCfgs
const fs = require('fs'), path = require('path');
const { loadScene, makeResolver, IDENT } = require('./scene.js');
const R = require('./render.js');
R.decalFlip.v = true; // decal v runs along -z (checked on the Africa fence decals)

// the Enbesa ornaments' 1x1 sand decal, read from the extracted vanilla tree
const SAND = makeResolver('D:/anno_data/1800').texture('data/dlc06/graphics/buildings/ornamental/maps/africa_ornaments_1x1_ground_sand_01_diff.psd');
const A = 285 * Math.PI / 180, E = 45 * Math.PI / 180, SUN = [Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A)];
const LUT = require('./tone_lut.json');
const tone = c => c.map((v, k) => { const x = Math.max(0, Math.min(255, v)), i = Math.floor(Math.min(254, x)), f = x - i; return LUT[k][i] * (1 - f) + LUT[k][i + 1] * f; });
const LOOK = { el: 38.5, az: 225, mirror: true, light: SUN, amb: 0.25, dif: 0.75, skyColor: [0.8, 0.9, 1.15], sunColor: [1.1, 1.0, 0.85], aoDirs: 24, aoStrength: 1 };

function footprint(file) {
  const ifo = file.replace(/\.cfg$/i, '.ifo');
  if (!fs.existsSync(ifo)) return null;
  const t = fs.readFileSync(ifo, 'utf8'), m = t.match(/<BuildBlocker>([\s\S]*?)<\/BuildBlocker>/);
  if (!m) return null;
  const xs = [...m[1].matchAll(/<xf>([^<]*)</g)].map(x => +x[1]), zs = [...m[1].matchAll(/<zf>([^<]*)</g)].map(x => +x[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

// sand ground over a footprint: 9-slice alpha (the 1x1 decal's rounded border keeps its world size), colour from
// the texture interior, mirror-tiled every 1.1 units
function sandGround(fp, margin = 0.05) {
  const hx = (fp.x1 - fp.x0) / 2 + margin, hz = (fp.z1 - fp.z0) / 2 + margin, cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
  const B = 0.55, P = 1.1;
  const slice = (t, h) => { // t in [0,1] across 2h world units -> texture coordinate
    const x = t * 2 * h;
    if (x < B) return x / P;
    if (x > 2 * h - B) return 1 - (2 * h - x) / P;
    return 0.5;
  };
  const tile = (t, h) => { const x = t * 2 * h / P, f = x - 2 * Math.floor(x / 2), m = f <= 1 ? f : 2 - f; return 0.06 + 0.88 * m; };
  const S = (u, v) => {
    const a = R_sample(SAND, slice(u, hx), slice(v, hz))[3];
    const c = R_sample(SAND, tile(u, hx), tile(v, hz));
    return [c[0], c[1], c[2], a];
  };
  return { T: { p: [cx, 0, cz], q: [0, 0, 0, 1], s: [1, 1, 1] }, hx, hz, tex: SAND, sampler: S, flipU: false, flipV: false };
}
function R_sample(t, u, v) {
  u = Math.min(0.99999, Math.max(0, u)); v = Math.min(0.99999, Math.max(0, v));
  const fx = u * t.w - 0.5, fy = v * t.h - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0, o = [0, 0, 0, 0];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x = Math.min(t.w - 1, Math.max(0, x0 + i)), y = Math.min(t.h - 1, Math.max(0, y0 + j)), w = (i ? ax : 1 - ax) * (j ? ay : 1 - ay), q = (y * t.w + x) * t.ch;
    for (let k = 0; k < 4; k++) o[k] += (k < t.ch ? t.px[q + k] : 255) * w;
  }
  return o;
}

// alpha-weighted mean luminance of a texture
function meanLum(t) { let s = 0, w = 0; for (let i = 0; i < t.w * t.h; i++) { const a = t.ch === 4 ? t.px[i * 4 + 3] / 255 : 1, o = i * t.ch; s += a * (0.3 * t.px[o] + 0.59 * t.px[o + 1] + 0.11 * t.px[o + 2]); w += a; } return w ? s / w : 0; }
const SAND_LUM = meanLum(SAND);

function bounds(img, size, thr = 0.5) {
  let x0 = size, x1 = -1, y0 = size, y1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (img[(y * size + x) * 4 + 3] > thr) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1 };
}

function makeIcon(modRoot, cfgRel, out, o = {}) {
  const rot = o.rotY ? { p: [0, 0, 0], q: [0, Math.sin(o.rotY * Math.PI / 360), 0, Math.cos(o.rotY * Math.PI / 360)], s: [1, 1, 1] } : IDENT;
  const skip = o.skipModel ? new RegExp(o.skipModel, 'i') : null;
  const scene = loadScene(modRoot, cfgRel, rot, { skipModel: skip ? (n, f) => skip.test(n) || skip.test(f) : null, pngDecals: o.pngDecals });
  for (const extra of o.extraCfgs || []) { const s2 = loadScene(modRoot, extra.cfg, extra.xf || IDENT); scene.tris.push(...s2.tris); scene.decals.push(...s2.decals); }
  // bright paving decals would sit on the tone curve's shoulder: bring them down to the sand's brightness
  for (const d of scene.decals) { const m = meanLum(d.tex), k = Math.min(1, (o.decalLum ?? 1.1) * SAND_LUM / m); d.mul = [k, k, k]; if (k < 1) console.log(`  decal ${path.basename(d.src)} x${k.toFixed(2)}`); }
  let fp = o.footprint ? { x0: -o.footprint[0], x1: o.footprint[0], z0: -o.footprint[1], z1: o.footprint[1] } : footprint(path.join(modRoot, cfgRel));
  if (!fp) { console.log('  no footprint, using 1x1'); fp = { x0: -0.5, x1: 0.5, z0: -0.5, z1: 0.5 }; }
  if (o.rotY && Math.abs(o.rotY) % 180 === 90) fp = { x0: fp.z0, x1: fp.z1, z0: fp.x0, z1: fp.x1 };
  const ground = o.noGround ? [] : [sandGround(fp)];
  const W = o.width ?? 120, BOT = o.bottom ?? 124, TOP = o.top ?? 2;
  const base = { ...LOOK, ground, ss: 4, smSize: 2048, aoSize: 512 };
  // pass 1: rough framing, then measure the outlined image and re-frame (twice, the outline does not scale)
  let r = R.render(scene, { ...base, ss: 1, aoDirs: 0, fit: { width: 110, bottom: 120, top: 8, maxW: 116 } });
  let view = r.view;
  for (let it = 0; it < 3; it++) {
    const ol = R.outline(r.img, 128), b = bounds(ol, 128);
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
    const f = Math.min(W / w, (BOT - TOP + 1) / h);
    // screen coords of the measured box
    const sxL = view.cx + (b.x0 - 64) / view.k, sxR = view.cx + (b.x1 + 1 - 64) / view.k, syB = view.bottomY + (view.bottom - (b.y1 + 1)) / view.k;
    view = { k: view.k * f, cx: (sxL + sxR) / 2, bottomY: syB, bottom: BOT + 1 };
    r = R.render(scene, { ...base, ss: 1, aoDirs: 0, view });
  }
  r = R.render(scene, { ...base, view });
  const ol = R.outline(r.img, 128);
  R.toPng(out, ol, 128, o.post || tone);
  const b = bounds(ol, 128);
  console.log(`${out}: tris ${scene.tris.length}, decals ${scene.decals.length}, fp ${JSON.stringify(fp)}, box x ${b.x0}-${b.x1} y ${b.y0}-${b.y1}`);
}
module.exports = { makeIcon };
if (require.main === module) {
  const [modRoot, cfg, out, opt] = process.argv.slice(2);
  makeIcon(modRoot, cfg, out, opt ? JSON.parse(opt) : {});
}
