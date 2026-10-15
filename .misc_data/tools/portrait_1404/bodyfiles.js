// Body mesh + texture into game files, as portrait_body/build.sh does for the Nomad/Envoy:
// work/<id>/body/body.gltf -> <id>_body.rdm (P4h_N4b_G4b_B4b_T2h, no skin, rdm4 of the Anno modding tools extension),
// body_diff.png -> <id>_body_diff.png -> annotex BC7 _0.._2.   node bodyfiles.js [id ...]
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const WORK = path.join(__dirname, 'work');
const ext = path.join(os.homedir(), '.vscode/extensions');
const RDM4 = path.join(ext, fs.readdirSync(ext).filter(d => d.startsWith('jakobharder.anno-modding-tools-')).sort().pop(), 'external/rdm4-bin.exe');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json')));
const want = process.argv.slice(2);
const sh = (cmd, a, cwd) => { const r = spawnSync(cmd, a, { encoding: 'utf8', cwd }); if (r.status !== 0) throw new Error(cmd + ' ' + a.join(' ') + '\n' + r.stdout + r.stderr); };
for (const p of manifest.filter(q => !want.length || want.includes(q.id))) {
  const dir = path.join(WORK, p.id, 'body');
  sh(RDM4, ['-i', path.join(dir, 'body.gltf'), '-o', path.join(dir, `${p.id}_body.rdm`), '-g', 'P4h_N4b_G4b_B4b_T2h', '--no_transform', '--force']);
  fs.copyFileSync(path.join(dir, 'body_diff.png'), path.join(dir, `${p.id}_body_diff.png`));
  sh('C:/tools/annotex.exe', ['-f=diff', '-l=3', `${p.id}_body_diff.png`], dir);
  console.log(p.id, fs.statSync(path.join(dir, `${p.id}_body.rdm`)).size, 'bytes rdm');
}
