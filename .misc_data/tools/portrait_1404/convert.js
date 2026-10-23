// Converts the portraits in manifest.json: 1404 .gr2 -> (Nexus Buddy) .cn6/.na2 -> (Blender 3.5) .glb
// -> (rdm4-bin) .rdm, the same chain that produced the Nomad and Envoy portraits, with two fixes in between:
// - several sub-meshes are merged into one (cn6merge.js), as rdm4 converts only the first glTF mesh;
// - the na2 matrices are made rigid relative to the importer's rest pose (na2rigid.js), so bones with a scaled
//   or mirrored Granny bind come out right (the Nomad's Bone_cloth_Left problem);
// - a portrait with retargetFrom (Sick Emperor) gets that portrait's .na2 retargeted onto its skeleton (na2retarget.js).
// Each result is round-tripped through rdm4 and compared with the Granny ground truth from the raw .na2
// (animcheck.js). A bone still off by more than BROKEN units loses its skin weights (cn6fix.js, the Nomad's
// hand repair) and the portrait is converted again.
//
// node convert.js [--reuse] [id ...]      (no ids = all; --reuse keeps existing Nexus Buddy exports)
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const { run: animcheck } = require('./animcheck.js');
const { fix } = require('./cn6fix.js');
const { merge } = require('./cn6merge.js');
const { rigidify } = require('./na2rigid.js');
const { retarget } = require('./na2retarget.js');

const HERE = __dirname;
const WORK = path.join(HERE, 'work');
const NBDRIVER = path.join(WORK, 'nbdriver', 'NbDriver.exe');
const BLENDER = 'C:/Program Files/Blender Foundation/Blender 3.5/blender.exe';
const RDM4 = 'C:/tools/rdm4-bin.exe';
const VFMT = 'P4h_N4b_G4b_B4b_T2h_I4b_W4b';
const PARALLEL = 12;
const BROKEN = 5; // mesh units; healthy bones stay below ~2 (half-float rounding)

const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json')));
const args = process.argv.slice(2), reuse = args.includes('--reuse'), want = args.filter(a => !a.startsWith('--'));
const jobs = want.length ? manifest.filter(p => want.includes(p.id)) : manifest;

const base = f => path.basename(f).replace(/\.gr2$/i, '').toLowerCase();
const sh = (cmd, a) => { const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error(cmd + ' ' + a.join(' ') + '\n' + r.stdout + r.stderr); return r.stdout; };
const spawnP = (cmd, a, log) => new Promise((res, rej) => {
  const p = spawn(cmd, a); let out = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', code => { if (log) fs.writeFileSync(log, out); code === 0 && /Export finished/.test(out) ? res(out) : rej(new Error(cmd + ' exited ' + code + ' ' + a.join(' ') + '\n' + out.slice(-2000))); });
});
function pool(tasks, n) {
  return new Promise((resolve, reject) => {
    let i = 0, active = 0, done = 0;
    const next = () => {
      if (done === tasks.length) return resolve();
      while (active < n && i < tasks.length) { const t = tasks[i++]; active++; t().then(() => { active--; done++; next(); }, reject); }
    };
    next();
  });
}
const secs = t0 => ((Date.now() - t0) / 1000).toFixed(0) + 's';
const animsOf = p => [...new Set(Object.values(p.slots))].map(base);
const na2Of = (dir, b) => { const f = fs.readdirSync(dir).find(x => x.startsWith(b + '__') && x.endsWith('.na2')); if (!f) throw new Error('no na2 for ' + b + ' in ' + dir); return path.join(dir, f); };

// 1. Nexus Buddy: gr2 -> cn6 + na2 (x86 process, sequential)
function nexusBuddy(p) {
  const dir = path.join(WORK, p.id), src = path.join(dir, 'src');
  fs.mkdirSync(src, { recursive: true });
  const files = [p.mesh, ...(p.retargetFrom ? [] : new Set(Object.values(p.slots)))].map(f => { const d = path.join(src, path.basename(f).toLowerCase()); fs.copyFileSync(f, d); return d; });
  const before = new Set(fs.readdirSync(os.tmpdir()));
  const out = sh(NBDRIVER, files);
  for (const f of fs.readdirSync(os.tmpdir())) if (!before.has(f) && /^temp(anim)?open\d+\.gr2$/.test(f)) fs.unlinkSync(path.join(os.tmpdir(), f));
  fs.writeFileSync(path.join(dir, 'nbdriver.log'), out);
}

// Sick Emperor: the source portrait's na2 (already exported, it comes first in the manifest) onto this skeleton
function retargetAnims(p) {
  const from = manifest.find(q => q.id === p.retargetFrom), fsrc = path.join(WORK, from.id, 'src'), src = path.join(WORK, p.id, 'src');
  for (const b of animsOf(p)) {
    const f = na2Of(fsrc, b);
    const r = retarget(path.join(fsrc, base(from.mesh) + '.cn6'), f, path.join(src, base(p.mesh) + '.cn6'), path.join(src, path.basename(f)));
    if (b === animsOf(p)[0]) console.log('retarget', from.id, '->', p.id, 'bones', r.shared.join(' '), '| at rest:', r.still.join(' '));
  }
}

// 2. Blender: one glb per unique animation, from the rigid na2 (all portraits in parallel)
function blenderTasks(p, cn6) {
  const dir = path.join(WORK, p.id), glb = path.join(dir, 'glb');
  fs.mkdirSync(glb, { recursive: true });
  return animsOf(p).map(b => () => spawnP(BLENDER, ['--background', '--python', path.join(HERE, 'cn6_na2_to_glb.py'), '--', cn6, na2Of(path.join(dir, 'src', 'rigid'), b), path.join(glb, b + '.glb')], path.join(glb, b + '.log')));
}

// 3. rdm4: glb -> mesh + anim rdm; round trip into its own folder (rdm4 names the buffers buffer0..n.bin) and check
function rdmAndCheck(p, cn6) {
  const dir = path.join(WORK, p.id), src = path.join(dir, 'src'), glb = path.join(dir, 'glb'), rdm = path.join(dir, 'rdm');
  fs.mkdirSync(rdm, { recursive: true });
  const res = {};
  for (const b of animsOf(p)) {
    sh(RDM4, ['-i', path.join(glb, b + '.glb'), '-sa', '-g=' + VFMT, '--no_transform', '--force', '-o', path.join(rdm, b + '.rdm')]);
    const chk = path.join(dir, 'check', b);
    fs.mkdirSync(chk, { recursive: true });
    sh(RDM4, ['-i', path.join(rdm, b + '.rdm'), '-o', path.join(chk, 'rt'), '-s', '-e', 'gltf', '-m', path.join(rdm, b + '_anim_0.rdm'), '-a', '--force']);
    res[b] = animcheck(cn6, na2Of(src, b), path.join(chk, 'rt.gltf'), 15);
  }
  return res;
}
const brokenOf = res => { const s = new Set(); for (const r of Object.values(res)) for (const [bn, e] of Object.entries(r.boneXform)) if (e > BROKEN) s.add(bn); return [...s]; };

async function main() {
  const t0 = Date.now();
  const report = {}, cn6Of = {};
  for (const p of jobs) {
    const src = path.join(WORK, p.id, 'src');
    if (!(reuse && fs.existsSync(path.join(src, base(p.mesh) + '.cn6')))) { nexusBuddy(p); console.log('nb', p.id, secs(t0)); }
    if (p.retargetFrom) retargetAnims(p);
    cn6Of[p.id] = path.join(src, base(p.mesh) + '.cn6');
    const merged = cn6Of[p.id].replace(/\.cn6$/, '_merged.cn6');
    if (merge(cn6Of[p.id], merged) > 1) { cn6Of[p.id] = merged; console.log('merged sub-meshes', p.id); }
    fs.mkdirSync(path.join(src, 'rigid'), { recursive: true });
    const rigid = new Set();
    for (const b of animsOf(p)) { const f = na2Of(src, b); for (const n of rigidify(cn6Of[p.id], f, path.join(src, 'rigid', path.basename(f)))) rigid.add(n); }
    report[p.id] = { rigidified: [...rigid] };
    if (rigid.size) console.log('rigid', p.id, [...rigid].join(' '));
  }
  await pool(jobs.flatMap(p => blenderTasks(p, cn6Of[p.id])), PARALLEL);
  console.log('blender pass 1', secs(t0));
  const redo = [];
  for (const p of jobs) {
    const res = rdmAndCheck(p, cn6Of[p.id]), broken = brokenOf(res);
    Object.assign(report[p.id], { pass1: res, broken });
    if (broken.length) {
      const fixed = cn6Of[p.id].replace(/\.cn6$/, '_fixed.cn6');
      report[p.id].fix = fix(cn6Of[p.id], fixed, broken);
      cn6Of[p.id] = fixed; redo.push(p);
    }
    console.log('check', p.id, broken.length ? 'broken: ' + broken.join(' ') : 'ok', secs(t0));
  }
  if (redo.length) {
    await pool(redo.flatMap(p => blenderTasks(p, cn6Of[p.id])), PARALLEL);
    console.log('blender pass 2', secs(t0));
    for (const p of redo) {
      const res = rdmAndCheck(p, cn6Of[p.id]), still = brokenOf(res);
      report[p.id].pass2 = res;
      console.log('recheck', p.id, still.length ? 'STILL broken: ' + still.join(' ') : 'ok');
    }
  }
  for (const p of jobs) report[p.id].cn6 = cn6Of[p.id];
  const rf = path.join(WORK, 'report_' + (want.length ? want.join('_') : 'all') + '.json');
  fs.writeFileSync(rf, JSON.stringify(report, null, 1));
  console.log('done', secs(t0), rf);
}
main().catch(e => { console.error(e); process.exit(1); });
