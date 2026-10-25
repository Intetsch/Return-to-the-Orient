// Recolours the canal and basin (noria / irrigation chain) icons to the canal's grey sandstone.
// node icons.js <mod root> [vanilla root]   (needs C:\tools\texconv.exe and C:\tools\annotex.exe)
// Output: <mod>/data/graphics/icons/irrigation/icon_{canal,basin}_orient.png + _0.._3.dds
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const PNG = require('./png.js');
const { rgb2lab, lab2rgb } = require('./lab.js');

const MOD = process.argv[2];
const VAN = process.argv[3] || 'D:/anno_data/1800';
if (!MOD) { console.error('usage: node icons.js <mod root> [vanilla root]'); process.exit(1); }
const outDir = path.join(MOD, 'data/graphics/icons/irrigation');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'canal_icons_'));
fs.mkdirSync(outDir, { recursive: true });

const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
// Target = the canal stone (rim Lab ~59/3/16, noria pool-edge blocks a 2-4, b 15-19), but warmer: flat in the UI that
// hue (~79 deg) read green next to the water (user, 2026-10-17), so the icons sit at a ~5.5, b ~14.5 (~69 deg) and the
// shaded sides can't go below a 3. The icons keep their painted lightness; only the warm stone colour
// (measured median a/b per icon) moves.
const ICONS = [
  { src: 'data/ui/2kimages/main/3dicons/icon_canal', out: 'icon_canal_orient', a: 14, b: 20, mask: () => 1 },
  // basin: only the brick ring (r >= 44 of 64); the drop's pale highlight is warm too
  { src: 'data/ui/2kimages/main/3dicons/scenario/icon_basin', out: 'icon_basin_orient', a: 22, b: 18,
    mask: (x, y, w, h) => ss(42, 46, Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2)) },
];

for (const I of ICONS) {
  execFileSync('C:/tools/texconv.exe', ['-nologo', '-y', '-ft', 'png', '-o', tmp, path.join(VAN, I.src + '_0.dds')], { stdio: 'pipe' });
  const img = PNG.decode(path.join(tmp, path.basename(I.src) + '_0.png')), d = img.data;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const o = (y * img.w + x) * 4;
    const [L, a, b] = rgb2lab(d[o], d[o + 1], d[o + 2]);
    const w = ss(4, 10, Math.hypot(a, b)) * ss(-2, 3, b) * I.mask(x, y, img.w, img.h); // warm stone, not water/outline
    if (w <= 0.001) continue;
    const s = [L, Math.max(3, 5.5 + (a - I.a) * 0.12), 14.5 + (b - I.b) * 0.35];
    d.set(lab2rgb(s[0] * w + L * (1 - w), s[1] * w + a * (1 - w), s[2] * w + b * (1 - w)), o);
  }
  const png = path.join(outDir, I.out + '.png');
  PNG.encode(png, img);
  execFileSync('C:/tools/annotex.exe', ['-f=diff', '-l=4', png], { stdio: 'pipe', cwd: outDir });
  console.log('icon', I.out);
}
fs.rmSync(tmp, { recursive: true, force: true });
