// Builds manifest.json from the 1404 portrait cfgs: mesh, diffuse texture and the six animations the
// 1800 portrait cfg uses, resolved through the 1404 sequence IDs
// (2000x idle / 2100x talk; x = 1 friendly, 2 neutral, 3 angry; 0/4 = very friendly/angry, unused).
const fs = require('fs'), path = require('path');
const ROOT = 'D:/anno_data/1404/data/graphics';
// base game first, then the addon (Venice: Giacomo Garibaldi, Spy), so the asset GUIDs of the first 32 stay put
const PORTRAIT_DIRS = [ROOT + '/units/portraits', 'D:/anno_data/1404/addondata/graphics/units/portraits'];
const SKIP = new Set([
  'nomad/s_nomad.cfg', 'embassador/s_embassador.cfg', // already in the mod as Nomad / Envoy
  'player/n_player.cfg', // the peasant mesh with player_0.dds, a 2008 placeholder that is black in every block
]);
const SLOTS = { friendly_idle: 20001, neutral_idle: 20002, angry_idle: 20003, friendly_talk: 21001, neutral_talk: 21002, angry_talk: 21003 };
// Granny (Nexus Buddy) cannot sample any animation on Sick Emperor's model (access violation in SampleAnimation,
// also after a resave or a BR2 rebuild). He gets the Emperor's six animations, retargeted from the Emperor's
// .na2 onto his skeleton (na2retarget.js); his own 1404 animations stay listed as slots1404.
const RETARGET = { sick_emperor: 'emperor' };
const ID = { // cfg -> mod id
  'lord_richard_northburg/n_lord_richard_northburg.cfg': 'lord_richard_northburg',
  'lord_richard_northburg/s_lord_richard_northburg.cfg': 'lord_richard_northburg_orient',
};

// case-insensitive path resolution on the extracted tree
function resolve(rel) {
  let cur = ROOT.replace(/\/data\/graphics$/, '');
  for (const part of rel.replace(/\\/g, '/').split('/')) {
    const hit = fs.readdirSync(cur).find(e => e.toLowerCase() === part.toLowerCase());
    if (!hit) throw new Error('missing ' + rel + ' at ' + part);
    cur = cur + '/' + hit;
  }
  return cur;
}

// The Spy's cfg plays his talk animations in the idle sequences too, though his own *_idle files ship next to them:
// an idle slot that resolves to <x>_talk.gr2 takes <x>_idle.gr2 when that file exists.
function idleFile(slot, f) {
  if (!slot.endsWith('_idle') || !/_talk\.gr2$/i.test(f)) return f;
  const alt = f.replace(/_talk\.gr2$/i, '_idle.gr2');
  const hit = fs.readdirSync(path.dirname(alt)).find(e => e.toLowerCase() === path.basename(alt).toLowerCase());
  return hit ? path.dirname(alt) + '/' + hit : f;
}

const out = [];
for (const PORTRAITS of PORTRAIT_DIRS) for (const d of fs.readdirSync(PORTRAITS).sort()) {
  for (const f of fs.readdirSync(path.join(PORTRAITS, d)).filter(x => x.endsWith('.cfg')).sort()) {
    const key = d + '/' + f;
    if (SKIP.has(key)) continue;
    const s = fs.readFileSync(path.join(PORTRAITS, d, f), 'latin1');
    const files = [...s.matchAll(/<m_FileName>([^<]*)<\/m_FileName>/g)].map(m => m[1]);
    const mesh = resolve(files[0]);
    const anims = files.slice(1).map(resolve);
    const tex = s.match(/<m_DiffuseTexture>([^<]*)</)[1];
    const texDds = resolve(tex.replace(/\.png$/i, '_0.dds'));
    const seq = {};
    for (const b of s.split('<m_SequenceID>').slice(1)) {
      const id = +b.match(/^(\d+)/)[1], a = b.match(/<m_AnimationID>(-?\d+)</);
      if (a) seq[id] = +a[1];
    }
    const slots = {};
    for (const [slot, sid] of Object.entries(SLOTS)) {
      if (!(sid in seq)) throw new Error(key + ' has no sequence ' + sid);
      slots[slot] = idleFile(slot, anims[seq[sid]]);
    }
    const id = ID[key] || d;
    out.push({ id, cfg: key, mesh, tex: texDds, slots });
  }
}
for (const p of out) if (RETARGET[p.id]) {
  const from = out.find(q => q.id === RETARGET[p.id]);
  Object.assign(p, { retargetFrom: from.id, slots1404: p.slots, slots: Object.assign({}, from.slots) });
}
fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(out, null, 1));
for (const p of out) {
  const uniq = new Set(Object.values(p.slots));
  console.log(p.id.padEnd(30), path.basename(p.mesh).padEnd(34), path.basename(p.tex).padEnd(36), uniq.size, 'anims');
}
console.log(out.length, 'portraits');
