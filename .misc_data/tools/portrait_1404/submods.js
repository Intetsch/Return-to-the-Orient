// One submod per player portrait, in the order of picker.json: Natoncy_player_portrait_1404_<nn>_<id> next to the main
// mod's modinfo.json, with its own modinfo.json and assets.xml (the Portrait asset + its picker entry). The graphics
// (data/graphics/portraits/<graphics>) and the tile (data/ui/2kimages/main/profiles/<icon>*) live in it too;
// assemble.js and icons.js write them there for the 1404 conversions, ../portrait_body/build.sh for the Nomad and Envoy.
//
// The picker list (CreateGameScene 500769) gets its entries in picker.json order whatever order the game loads the
// submods in, and with any of them left out: each entry goes right after the nearest earlier entry already in the
// list, else right before the nearest later one, else at the end. Each step only fires while the entry is not in the
// list yet (AllowNoMatch: a step that finds nothing to anchor on is expected, not an error).
//
// node submods.js <mod folder>   writes every submod's modinfo.json + assets.xml and the submod ModIDs into the main
//                                 modinfo's ModDependencies
const fs = require('fs'), path = require('path');
const HERE = __dirname;
const LANGS = ['English', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Polish', 'Russian', 'Chinese', 'Spanish', 'Taiwanese'];

function entries() {
  return JSON.parse(fs.readFileSync(path.join(HERE, 'picker.json'))).portraits.map((e, i) => {
    const nn = String(i + 1).padStart(2, '0'), folder = `Natoncy_player_portrait_1404_${nn}_${e.id}`;
    return {
      assetName: `portrait_1404_${e.id}`, icon: `portrait_1404_${e.id}`, graphics: `1404/${e.id}`,
      ...e, nn, folder, modId: folder.toLowerCase(),
    };
  });
}
const submod = id => { const e = entries().find(q => q.id === id); if (!e) throw new Error(id + ' is not in picker.json'); return e; };

const crlf = s => s.replace(/\r?\n/g, '\r\n');
// files are only rewritten when their content changes (line endings aside)
const lf = s => s.replace(/\r\n/g, '\n');
const write = (f, s) => { if (!fs.existsSync(f) || lf(fs.readFileSync(f, 'utf8')) !== lf(s)) fs.writeFileSync(f, s); };
const anyOf = gs => gs.map(g => `Portrait='${g}'`).join(' or ');
// ModOps placing guids[k] relative to the other entries
function pickerOps(guids, k) {
  const own = guids[k], before = guids.slice(0, k), after = guids.slice(k + 1);
  const list = `Values/CreateGameScene/Portraits[not(Item/Portrait='${own}')]`;
  const op = (type, p) => `    <ModOp Type="${type}" GUID="500769" Path="${p}" AllowNoMatch="1">
        <Item>
            <Portrait>${own}</Portrait>
        </Item>
    </ModOp>`;
  const ops = [];
  if (before.length) ops.push(op('addNextSibling', `${list}/Item[${anyOf(before)}][last()]`));
  if (after.length) ops.push(op('addPrevSibling', `${list}/Item[${anyOf(after)}][1]`));
  ops.push(op('add', list));
  return ops.join('\n');
}

function assetsXml(e, guids, k) {
  return `<ModOps>

    <!-- Anno 1404 player portrait ${e.nn}: ${e.name} (${e.group}) -->
    <ModOp Type="addNextSibling" GUID="114620">
        <Asset>
            <Template>Portrait</Template>
            <Values>
                <Portrait />
                <Standard>
                    <GUID>${e.guid}</GUID>
                    <Name>${e.assetName}</Name>
                    <IconFilename>data/ui/2kimages/main/profiles/${e.icon}.png</IconFilename>
                </Standard>
                <Mesh />
                <Object>
                    <Variations>
                        <Item>
                            <Filename>data/graphics/portraits/${e.graphics}/${path.posix.basename(e.graphics)}.cfg</Filename>
                        </Item>
                    </Variations>
                </Object>
                <Locked />
            </Values>
        </Asset>
    </ModOp>

    <!-- portrait picker of the new game / profile screen
         whichever of the portrait submods are loaded and in whatever order: right after the nearest earlier entry
         already in the list, else right before the nearest later one, else at the end -->
${pickerOps(guids, k)}

</ModOps>
`;
}

function modinfo(e, old) {
  const all = v => Object.fromEntries(LANGS.map(l => [l, v]));
  return {
    Version: old?.Version ?? '1.0.0',
    ModID: e.modId,
    Category: all('Shared'),
    ModName: all(`Player Portrait 1404: ${e.name}`),
    Description: {
      English: `${e.name} from Anno 1404 as an animated player portrait, for the portrait picker of the new game and profile screen. Part of Return to the Orient.`,
      German: `${e.name} aus Anno 1404 als animiertes Spielerporträt, für die Porträtauswahl beim Spielstart und im Profil. Teil von Return to the Orient.`,
    },
    CreatorName: 'Natoncy',
  };
}

if (require.main === module) {
  const MOD = process.argv[2];
  const all = entries(), guids = all.map(e => e.guid);
  all.forEach((e, k) => {
    const dir = path.join(MOD, e.folder);
    fs.mkdirSync(path.join(dir, 'data/config/export/main/asset'), { recursive: true });
    const mi = path.join(dir, 'modinfo.json');
    const old = fs.existsSync(mi) ? JSON.parse(fs.readFileSync(mi, 'utf8')) : null;
    write(mi, JSON.stringify(modinfo(e, old), null, 2) + '\n');
    write(path.join(dir, 'data/config/export/main/asset/assets.xml'), crlf(assetsXml(e, guids, k)));
  });
  // main modinfo: the submods are bundled like the other submods, so they are listed as dependencies
  const mf = path.join(MOD, 'modinfo.json'), raw = fs.readFileSync(mf, 'utf8'), info = JSON.parse(raw);
  if (JSON.stringify(info, null, 2) + '\n' !== raw.replace(/\r\n/g, '\n')) throw new Error('modinfo.json would be reformatted, edit ModDependencies by hand');
  const ids = all.map(e => e.modId);
  info.ModDependencies = info.ModDependencies.filter(d => !d.startsWith('natoncy_player_portrait_1404_') || ids.includes(d));
  for (const d of ids) if (!info.ModDependencies.includes(d)) info.ModDependencies.push(d);
  write(mf, JSON.stringify(info, null, 2) + '\n');
  // stale submods (renumbered or dropped from picker.json) are reported, not deleted
  const stale = fs.readdirSync(MOD).filter(d => d.startsWith('Natoncy_player_portrait_1404_') && !all.some(e => e.folder === d));
  console.log(all.length, 'submods written', stale.length ? '| not in picker.json (git mv them): ' + stale.join(' ') : '');
}

module.exports = { entries, submod };
