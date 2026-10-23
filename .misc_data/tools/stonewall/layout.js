// Renders a set of wall tiles the way the neighbour system would place them (piece + rotation from the neighbours).
// node layout.js <out.png> <size> <json opts> "x,z x,z ..."
const T = require('path').join(__dirname, '../ornament_icons/');
const { loadScene, IDENT } = require(T + 'scene.js');
const R = require(T + 'render.js');
R.decalFlip.v = true;
const MOD = require('path').resolve(__dirname, '../../..');
const [out, sz, oj, tiles] = process.argv.slice(2);
const o = JSON.parse(oj || '{}'), size = +sz;
const ARMS = { single: [], end: ['-x'], mid: ['-x', '+x'], corner: ['+x', '-z'], t: ['-x', '+x', '-z'], x: ['-x', '+x', '-z', '+z'] };
const ROT90 = { '+x': '-z', '-z': '-x', '-x': '+z', '+z': '+x' }; // +90 deg about y
// opts.junctions: { "x,z": "cross@90", ... } junction tiles (variation@degrees, +90 turns +x to -z); walls count them as neighbours
const J = o.junctions || {};
const set = new Set([...tiles.trim().split(/\s+/), ...Object.keys(J)]);
const scene = { tris: [], decals: [] };
const used = [];
for (const t of set) {
  const [x, z] = t.split(',').map(Number);
  // opts.step: raise every other tile, like neighbours fitted to uneven terrain
  const y = o.step && (x + z) % 2 ? o.step : 0;
  if (J[t]) {
    const [name, deg] = J[t].split('@'), phi = (+deg || 0) * Math.PI / 180;
    used.push(`${t}:junction ${J[t]}`);
    const s = loadScene(o.root || MOD, `data/graphics/buildings/orient/stonewall_junction/stonewall_junction_${name}.cfg`, { p: [x, y, z], q: [0, Math.sin(phi / 2), 0, Math.cos(phi / 2)], s: [1, 1, 1] });
    scene.tris.push(...s.tris); scene.decals.push(...s.decals);
    continue;
  }
  const D = [['+x', x + 1, z], ['-x', x - 1, z], ['+z', x, z + 1], ['-z', x, z - 1]].filter(([, a, b]) => set.has(a + ',' + b)).map(d => d[0]).sort().join();
  let pick = null;
  for (const [p, arms] of Object.entries(ARMS)) { let a = arms; for (let r = 0; r < 4; r++) { if ([...a].sort().join() === D) { pick = pick || [p, r]; } a = a.map(d => ROT90[d]); } }
  const [p, r] = pick, phi = r * Math.PI / 2;
  used.push(`${t}:${p}@${r * 90}`);
  // opts.variant: all tiles that size; opts.large: "x,z x,z" tiles that are large (both sizes connect to each other)
  const V = require('./variants.js')[o.variant || ((o.large || '').split(/\s+/).includes(t) ? 'large' : 'small')];
  const s = loadScene(o.root || MOD, `data/graphics/buildings/orient/${V.dir}/${V.prefix}_${p}.cfg`, { p: [x, y, z], q: [0, Math.sin(phi / 2), 0, Math.cos(phi / 2)], s: [1, 1, 1] });
  scene.tris.push(...s.tris);
  scene.decals.push(...s.decals);
}
// opts.cull: drop back faces like the game (the renderer itself draws both sides; it mirrors x before projecting)
if (o.cull) {
  const fwd = R.camera(o.el ?? 38.5, o.az ?? 225).fwd;
  scene.tris = scene.tris.filter(t => { const n = t.n[0]; return -n[0] * fwd[0] + n[1] * fwd[1] + n[2] * fwd[2] < 0; });
}
// sand ground under the tiles
const SAND = require(T + 'scene.js').makeResolver('D:/anno_data/1800').texture('data/dlc06/graphics/buildings/ornamental/maps/africa_ornaments_1x1_ground_sand_01_diff.psd');
const xs = [...set].map(t => +t.split(',')[0]), zs = [...set].map(t => +t.split(',')[1]);
const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, hx = (Math.max(...xs) - Math.min(...xs)) / 2 + 1, hz = (Math.max(...zs) - Math.min(...zs)) / 2 + 1;
const ground = o.noGround ? [] : [{ T: { p: [cx, 0, cz], q: [0, 0, 0, 1], s: [1, 1, 1] }, hx, hz, tex: SAND, sampler: (u, v) => { const t = SAND, X = Math.floor(((u * hx * 2 / 1.1) % 1) * 0.8 * t.w + 0.1 * t.w), Y = Math.floor(((v * hz * 2 / 1.1) % 1) * 0.8 * t.h + 0.1 * t.h), q = (Y * t.w + X) * t.ch; return [t.px[q], t.px[q + 1], t.px[q + 2], 255]; } }];
const A = (o.sunAz ?? 285) * Math.PI / 180, E = 45 * Math.PI / 180, SUN = [Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A)];
const r = R.render(scene, { el: o.el ?? 38.5, az: o.az ?? 225, mirror: true, light: SUN, amb: 0.3, dif: 0.75, skyColor: [0.8, 0.9, 1.15], sunColor: [1.1, 1.0, 0.85], aoDirs: o.ao ?? 8, aoStrength: 1, size, ss: 2, smSize: 2048, aoSize: 512, ground, fit: { groundPts: o.fitWalls ? scene.tris.flatMap(t => t.v).map(v => [-v[0], v[1], v[2]]) : undefined, width: size * 0.92, bottom: size - 6, top: 6, maxW: size - 8 } });
const img = r.img;
for (let i = 0; i < size * size; i++) { const a = img[i * 4 + 3]; for (let k = 0; k < 3; k++) img[i * 4 + k] = img[i * 4 + k] * a + 90 * (1 - a); img[i * 4 + 3] = 1; }
R.toPng(out, img, size, c => c.map(v => Math.max(0, Math.min(255, v))));
console.log(used.join(' '));
