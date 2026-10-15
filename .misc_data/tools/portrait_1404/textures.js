// 1404 diffuse (DXT5 .dds) -> <id>_diff.png -> annotex BC7 LOD chain <id>_diff_0.._2.dds,
// the same steps as the Envoy texture (shipped _0.._2 decode pixel-identical to annotex of the PNG).
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const HERE = __dirname, WORK = path.join(HERE, 'work');
const manifest = JSON.parse(fs.readFileSync(process.env.MANIFEST || path.join(HERE, 'manifest.json')));
const want = process.argv.slice(2);
const sh = (cmd, args, cwd) => { const r = spawnSync(cmd, args, { encoding: 'utf8', cwd }); if (r.status !== 0) throw new Error(cmd + ' ' + args.join(' ') + '\n' + r.stdout + r.stderr); return r.stdout; };
for (const p of manifest.filter(p => !want.length || want.includes(p.id))) {
  const dir = path.join(WORK, p.id, 'tex');
  fs.mkdirSync(dir, { recursive: true });
  const dds = path.join(dir, p.id + '_diff.dds');
  fs.copyFileSync(p.tex, dds);
  sh('C:/tools/texconv.exe', ['-nologo', '-y', '-ft', 'PNG', '-o', dir, dds]);
  fs.unlinkSync(dds);
  sh('C:/tools/annotex.exe', ['-f=diff', '-l=3', p.id + '_diff.png'], dir);
  console.log(p.id, fs.readdirSync(dir).join(' '));
}
