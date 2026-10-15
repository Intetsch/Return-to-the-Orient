// Copies the converted portraits into the mod: data/graphics/portraits/1404/<id>/{<id>.cfg,<id>.ifo,rdm,anim,maps},
// the texture source PNG into .misc_data, and writes the Portrait assets + picker entries.
// The cfg/ifo are the Envoy's bust-only originals (commit fbff52a9) with this portrait's files, and the
// ORIENTATION_TRANSFORM position chosen so the eyes (mean over neutral idle) land where the Nomad's and Envoy's do.
//
// node assemble.js <mod folder>
const fs = require('fs'), path = require('path');
const { eyes, S } = require('./eyes.js');
const HERE = __dirname, WORK = path.join(HERE, 'work');
const MOD = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json')));
const report = JSON.parse(fs.readFileSync(path.join(WORK, 'report_all.json')));
const GUID0 = 1404004600;
const EYE = { x: 0, y: 3.10 }; // shipped Nomad / Envoy: (-0.02, 3.13) / (0.00, 3.07) in their neutral idle
// cfg animation list of the Envoy: 9 entries -> sequences 10020,10021,10040,10010,10011,10031,10000,10001,10030
const CFG_ANIMS = ['angry_idle', 'angry_talk', 'angry_talk', 'friendly_idle', 'friendly_talk', 'friendly_talk', 'neutral_idle', 'neutral_talk', 'neutral_talk'];
const MOODS = ['angry', 'friendly', 'neutral'];

const crlf = s => s.replace(/\r?\n/g, '\r\n');
const base = f => path.basename(f).replace(/\.gr2$/i, '').toLowerCase();
const tplCfg = fs.readFileSync(path.join(HERE, 'template.cfg'), 'latin1');
const tplIfo = fs.readFileSync(path.join(HERE, 'template.ifo'), 'latin1');
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };

// file name per unique animation source: the slots it serves
function animNames(p) {
  const bySrc = {};
  for (const [slot, src] of Object.entries(p.slots)) (bySrc[base(src)] = bySrc[base(src)] || []).push(slot);
  const names = {};
  for (const [b, slots] of Object.entries(bySrc)) {
    let n;
    if (slots.length === 6) n = 'static';
    else if (slots.length === 1) n = slots[0];
    else if (slots.length === 2 && slots[0].split('_')[0] === slots[1].split('_')[0]) n = slots[0].split('_')[0];
    else n = slots.join('_');
    names[b] = n;
  }
  return names;
}

// The bust MODEL copied without its animations as a static body MODEL (same transform), as portrait_body/patchcfg.js
// does; the MAIN and mesh bounds keep their top and reach down to ymin (world). The ifo boxes get the same numbers.
function addBody(cfg, ifo, id, ymin) {
  const m0 = cfg.indexOf('<Models>'), mStart = cfg.indexOf('<Config>', m0);
  const close = cfg.indexOf('</Config>', cfg.indexOf('</Animations>', mStart)) + '</Config>'.length;
  let blk = cfg.slice(cfg.lastIndexOf('\n', mStart) + 1, close).replace(/\r?\n[ \t]*<Animations>[\s\S]*<\/Animations>/, '');
  const rep = (a, b) => { if (!blk.includes(a)) throw new Error(id + ' body: missing ' + a); blk = blk.replace(a, b); };
  rep('<Name>02___Default</Name>', '<Name>body</Name>');
  rep('<VertexFormat>P4h_N4b_G4b_B4b_T2h_I4b_W4b</VertexFormat>', '<VertexFormat>P4h_N4b_G4b_B4b_T2h</VertexFormat>');
  rep('<NumBonesPerVertex>4</NumBonesPerVertex>', '<NumBonesPerVertex>0</NumBonesPerVertex>');
  rep(`maps/${id}_diff.psd`, `maps/${id}_body_diff.psd`);
  rep(`rdm\\${id}.rdm`, `rdm\\${id}_body.rdm`);
  cfg = cfg.slice(0, close) + '\n' + blk + cfg.slice(close);
  const esc = t => t.split('.').join('[.]');
  const num = t => +cfg.match(new RegExp(`<${esc(t)}>([-0-9.]+)</`))[1];
  const setn = (t, v) => { cfg = cfg.replace(new RegExp(`(<${esc(t)}>)[-0-9.]+(</)`), `$1${v.toFixed(6)}$2`); };
  const grow = (C, E, R) => {
    const top = num(C + '.y') + num(E + '.y'), c = (top + ymin) / 2, e = (top - ymin) / 2;
    setn(C + '.y', c); setn(E + '.y', e); setn(R, Math.hypot(num(E + '.x'), e, num(E + '.z')));
    return { c, e };
  };
  const bb = grow('Center', 'Extent', 'Radius'), mb = grow('MeshCenter', 'MeshExtent', 'MeshRadius');
  const setBox = (box, v) => {
    const i = ifo.indexOf(`<${box}>`), j = ifo.indexOf(`</${box}>`, i);
    let b = ifo.slice(i, j);
    b = b.replace(/(<Position>[\s\S]*?<yf>)[-0-9.eE]+(<\/yf>)/, `$1${+v.c.toFixed(6)}$2`).replace(/(<Extents>[\s\S]*?<yf>)[-0-9.eE]+(<\/yf>)/, `$1${+v.e.toFixed(6)}$2`);
    ifo = ifo.slice(0, i) + b + ifo.slice(j);
  };
  setBox('BoundingBox', bb); setBox('MeshBoundingBox', mb);
  return { cfg, ifo };
}

const out = [];
manifest.forEach((p, i) => {
  const id = p.id, guid = GUID0 + i;
  const w = path.join(WORK, id), dst = path.join(MOD, 'data/graphics/portraits/1404', id);
  const names = animNames(p);
  // mesh: from the angry idle glb, as for the Nomad and Envoy (every glb carries the same rest mesh)
  const meshSrc = base(p.slots.angry_idle);
  cp(path.join(w, 'rdm', meshSrc + '.rdm'), path.join(dst, 'rdm', id + '.rdm'));
  for (const [b, n] of Object.entries(names)) cp(path.join(w, 'rdm', b + '_anim_0.rdm'), path.join(dst, 'anim', `${id}_${n}.rdm`));
  for (let l = 0; l < 3; l++) cp(path.join(w, 'tex', `${id}_diff_${l}.dds`), path.join(dst, 'maps', `${id}_diff_${l}.dds`));
  cp(path.join(w, 'tex', `${id}_diff.png`), path.join(MOD, '.misc_data/data/graphics/Portraits/1404', id, `${id}_diff.png`));

  // placement from the eyes in the neutral idle
  const e = eyes(path.join(w, 'check', base(p.slots.neutral_idle), 'rt.gltf'));
  const Px = EYE.x - S * (0.939693 * e.mean[0] + 0.342020 * e.mean[1]);
  const Py = EYE.y + S * e.mean[2];

  let cfg = tplCfg
    .replace('data/graphics/portraits/orient/resident_orient_tier02/maps/resident_orient_tier02_diff.psd', `data/graphics/portraits/1404/${id}/maps/${id}_diff.psd`)
    .replace('data\\graphics\\portraits\\orient\\resident_orient_tier02\\rdm\\resident_orient_tier02.rdm', `data\\graphics\\portraits\\1404\\${id}\\rdm\\${id}.rdm`)
    .replace(/<Position\.x>[^<]*<\/Position\.x>/, `<Position.x>${Px.toFixed(6)}</Position.x>`)
    .replace(/<Position\.y>[^<]*<\/Position\.y>/, `<Position.y>${Py.toFixed(6)}</Position.y>`);
  let k = 0;
  cfg = cfg.replace(/<FileName>data\\graphics\\portraits\\orient\\resident_orient_tier02\\anim\\[^<]*<\/FileName>/g, () => {
    const slot = CFG_ANIMS[k++];
    return `<FileName>data\\graphics\\portraits\\1404\\${id}\\anim\\${id}_${names[base(p.slots[slot])]}.rdm</FileName>`;
  });
  if (k !== 9 || /resident_orient/.test(cfg)) throw new Error('template substitution failed for ' + id);
  let ifo = tplIfo;
  // lower body (body1404.js / bake1404.js / bodyfiles.js): a second, static MODEL like the Nomad's and Envoy's
  // (portrait_body/patchcfg.js), and the bounds grown down to its hips
  const bodyDir = path.join(w, 'body');
  if (fs.existsSync(path.join(bodyDir, `${id}_body.rdm`))) {
    cp(path.join(bodyDir, `${id}_body.rdm`), path.join(dst, 'rdm', `${id}_body.rdm`));
    for (let l = 0; l < 3; l++) cp(path.join(bodyDir, `${id}_body_diff_${l}.dds`), path.join(dst, 'maps', `${id}_body_diff_${l}.dds`));
    cp(path.join(bodyDir, `${id}_body_diff.png`), path.join(MOD, '.misc_data/data/graphics/Portraits/1404', id, `${id}_body_diff.png`));
    ({ cfg, ifo } = addBody(cfg, ifo, id, Py - S * JSON.parse(fs.readFileSync(path.join(bodyDir, 'attrs.json'))).meta.zhip - 0.1));
  }
  fs.writeFileSync(path.join(dst, id + '.cfg'), crlf(cfg), 'latin1');
  fs.writeFileSync(path.join(dst, id + '.ifo'), crlf(ifo), 'latin1');

  const r = report[id], fixed = r && r.broken && r.broken.length ? r.broken : [];
  out.push({ id, guid, Px: +Px.toFixed(3), Py: +Py.toFixed(3), eyes: e.mean.map(x => +x.toFixed(1)), anims: Object.values(names), fixedBones: fixed, animationsFrom: p.retargetFrom || id });
});

// assets: Portrait per model (template copied from orient_resident_portrait02) + CreateGameScene picker list.
// An existing file is never regenerated: the user groups and orders the picker list by hand (AI difficulty, region,
// role). Only portraits missing from it are added: the Asset at the end of the first ModOp, the picker Item at the
// end of the 500769 list.
const assetBlock = o => `        <Asset>
            <Template>Portrait</Template>
            <Values>
                <Portrait />
                <Standard>
                    <GUID>${o.guid}</GUID>
                    <Name>portrait_1404_${o.id}</Name>
                    <IconFilename>data/ui/2kimages/main/profiles/portrait_1404_${o.id}.png</IconFilename>
                </Standard>
                <Mesh />
                <Object>
                    <Variations>
                        <Item>
                            <Filename>data/graphics/portraits/1404/${o.id}/${o.id}.cfg</Filename>
                        </Item>
                    </Variations>
                </Object>
                <Locked />
            </Values>
        </Asset>`;
const itemBlock = o => `        <Item>
            <Portrait>${o.guid}</Portrait>
        </Item>`;
const XMLF = path.join(MOD, 'data/config/export/main/asset/assets_includes/portraits/assets_1404_portraits.xml');
let xml;
if (!fs.existsSync(XMLF)) {
  xml = `<ModOps>

    <!-- the Anno 1404 character portraits, converted like the Nomad and Envoy (.misc_data/tools/portrait_1404) -->
    <ModOp Type="addNextSibling" GUID="114620">
${out.map(assetBlock).join('\n')}
    </ModOp>

    <!-- offer them in the portrait picker of the new game / profile screen -->
    <ModOp Type="add" GUID="500769" Path="Values/CreateGameScene/Portraits">
${out.map(itemBlock).join('\n')}
    </ModOp>

</ModOps>
`;
} else {
  xml = fs.readFileSync(XMLF, 'utf8').replace(/\r\n/g, '\n');
  // insert before the line "    </ModOp>" that closes the ModOp starting at `from`, after its last non-blank line
  const insertAtEnd = (from, text) => {
    const close = xml.indexOf('\n    </ModOp>', from);
    let j = close; while (/\s/.test(xml[j - 1])) j--;
    xml = xml.slice(0, j) + '\n' + text + xml.slice(j);
  };
  const newAssets = out.filter(o => !xml.includes(`<GUID>${o.guid}</GUID>`));
  if (newAssets.length) insertAtEnd(xml.indexOf('<ModOp Type="addNextSibling"'), newAssets.map(assetBlock).join('\n'));
  const newItems = out.filter(o => !xml.includes(`<Portrait>${o.guid}</Portrait>`));
  if (newItems.length) insertAtEnd(xml.indexOf('GUID="500769"'), newItems.map(itemBlock).join('\n'));
  console.log('assets added:', newAssets.map(o => o.id).join(' ') || '-', '| picker entries added:', newItems.map(o => o.id).join(' ') || '-');
}
fs.writeFileSync(XMLF, crlf(xml));
fs.writeFileSync(path.join(WORK, 'assembled.json'), JSON.stringify(out, null, 1));
for (const o of out) console.log(String(o.guid), o.id.padEnd(30), 'P', o.Px.toFixed(3).padStart(7), o.Py.toFixed(3).padStart(7), 'anims', o.anims.join(','), o.fixedBones.length ? 'weights dropped: ' + o.fixedBones.join(',') : '');
