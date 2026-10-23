// Installs the Oriental Wall Junction: data/graphics/buildings/orient/stonewall_junction/
//   rdm/stonewall_junction_<name>_{large,small}_lod0.rdm, stonewall_junction_<name>.cfg (large part with the large wall's
//   material, small part with the small wall's) and .ifo (the matching wall piece's blockers and hit boxes, large height).
// node install_junction.js <meshDir> [modRoot, default ../../..]
const fs = require('fs'), path = require('path');
const VARIANTS = require('./variants.js');
const { PIECES, FEEDBACK, material, cfg, ifo, bounds, CRLF } = require('./install.js');
const { SHAPE } = require('./build_junction.js');
const [meshDir, MOD = path.resolve(__dirname, '../../..')] = process.argv.slice(2);
const REL = 'data/graphics/buildings/orient/stonewall_junction', DST = path.join(MOD, REL);
fs.mkdirSync(path.join(DST, 'rdm'), { recursive: true });
const wallRel = v => `data/graphics/buildings/orient/${VARIANTS[v].dir}`;
const H = VARIANTS.large.H;
for (const [name, shape] of Object.entries(SHAPE)) {
  const models = ['large', 'small'].map(part => {
    const file = `stonewall_junction_${name}_${part}_lod0.rdm`;
    fs.copyFileSync(path.join(meshDir, name, file), path.join(DST, 'rdm', file));
    return { file: `${REL}/rdm/${file}`, material: material(wallRel(part), VARIANTS[part].prefix) };
  });
  const b = bounds(H);
  fs.writeFileSync(path.join(DST, `stonewall_junction_${name}.cfg`), CRLF(cfg(models, shape, b)));
  fs.writeFileSync(path.join(DST, `stonewall_junction_${name}.ifo`), CRLF(ifo(PIECES[shape], FEEDBACK[shape], b, H)));
}
console.log('installed', Object.keys(SHAPE).join(', '), 'into', DST);
