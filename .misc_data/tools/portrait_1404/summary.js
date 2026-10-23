// Re-checks every converted animation (work/<id>/check/<anim>/rt.gltf) against Granny and prints one line per portrait.
const fs = require('fs'), path = require('path');
const { run } = require('./animcheck.js');
const HERE = __dirname, WORK = path.join(HERE, 'work');
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json')));
const report = JSON.parse(fs.readFileSync(path.join(WORK, 'report_all.json')));
const base = f => path.basename(f).replace(/\.gr2$/i, '').toLowerCase();
const rows = [];
for (const p of manifest) {
  const src = path.join(WORK, p.id, 'src'), cn6 = report[p.id].cn6;
  let worst = 0, wb = '', vmax = 0, p99 = 0, um = 0, verts = 0, bones = 0;
  for (const b of new Set(Object.values(p.slots).map(base))) {
    const na2 = path.join(src, fs.readdirSync(src).find(f => f.startsWith(b + '__') && f.endsWith('.na2')));
    const r = run(cn6, na2, path.join(WORK, p.id, 'check', b, 'rt.gltf'), 10);
    for (const [k, v] of Object.entries(r.boneXform)) if (v > worst) { worst = v; wb = k; }
    bones = Math.max(bones, Object.keys(r.boneXform).length);
    vmax = Math.max(vmax, r.noroot.max); p99 = Math.max(p99, r.noroot.p99); um = Math.max(um, r.unmatched); verts = r.verts;
  }
  rows.push({ id: p.id, verts, unmatched: um, bonesChecked: bones, worstBone: wb, worstBoneErr: +worst.toFixed(2), vertexMax: +vmax.toFixed(2), vertexP99: +p99.toFixed(2), rigidified: report[p.id].rigidified.length });
  console.log(p.id.padEnd(30), 'verts', String(verts).padStart(4), 'unmatched', um, '| bones', String(bones).padStart(2), 'worst', (wb + ' ' + worst.toFixed(2)).padEnd(28), '| vertex max', vmax.toFixed(2).padStart(5), 'p99', p99.toFixed(2), '| rigidified', report[p.id].rigidified.length);
}
fs.writeFileSync(path.join(WORK, 'summary.json'), JSON.stringify(rows, null, 1));
