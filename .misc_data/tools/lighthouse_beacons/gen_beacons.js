// Oriental Lighthouse beacons: whatever ship or airship item sits in the completed lighthouse's
// socket is applied to all of the player's ships in every session.
//
// The engine has no "item socketed in building X" condition, so each mirrorable vanilla item gets
//   - an ItemSet of its own (1404007100+i); the item is patched to belong to it,
//   - a VehicleBuff copying its stat upgrades onto all ships/airships (1404007300+i),
//   - an "on" trigger (ItemSetsActive >= 1 -> ActionBuff add, 1404007500+i) and an "off" trigger
//     (ItemSetsActive < 1 -> ActionBuff remove, 1404007700+i) that register each other.
// The completed lighthouse (1404007002) lists every set in Culture/Sets.
//
// Mirrored: the item's passive upgrades, or for items without any, the self buff of its action
// (turbines, toolboxes, tax bills, diving bell gear). Items whose effect hinges on a pirate/white
// flag or a special projectile (flame throwers, mortars, torpedoes, marque letters) are skipped: on
// every ship permanently those make no sense, and without them only the drawbacks would be left.
//
// usage: node gen_beacons.js   (reads .misc_data/_original_assets.xml + _original_templates.xml)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const MISC = path.join(ROOT, '.misc_data');
const OUT = path.join(ROOT, 'data/config/export/main/asset/assets_includes/buildings/monument/assets_lighthouse_beacons.xml');

const LIGHTHOUSE = 1404007002;
const SET_BUFF = 1404007004;
const BASE = { set: 1404007100, buff: 1404007300, on: 1404007500, off: 1404007700 };
const MAX = 200;
// all ships, all tradeships NEW, all warships, all AirShips, all airships (scenario)
const TARGETS = [191454, 193982, 191458, 4146, 102492];

const ALLOC = new Set(['Ship', 'SailShip', 'SteamShip', 'Warship', 'AarhantShip', 'DivingVessel', 'AirShip']);
const PROPS = ['VehicleUpgrade', 'AttackerUpgrade', 'AttackableUpgrade', 'ProjectileUpgrade', 'TradeShipUpgrade', 'DivingBellUpgrade'];
const SKIP = /<(ActivatePirateFlag|ActivateWhiteFlag|UseProjectile)>/;

const assetsXml = fs.readFileSync(path.join(MISC, '_original_assets.xml'), 'utf8');
const templatesXml = fs.readFileSync(path.join(MISC, '_original_templates.xml'), 'utf8');

// template default allocations (ShipSpecialist etc. don't repeat it in the asset)
const tplAlloc = {};
for (const m of templatesXml.matchAll(/<Template>\s*<Name>([^<]*)<\/Name>\s*<Properties>([\s\S]*?)<\/Properties>/g)) {
  const a = (m[2].match(/<Item>[\s\S]*?<Allocation>([^<]*)<\/Allocation>[\s\S]*?<\/Item>/) || [])[1];
  if (a) tplAlloc[m[1]] = a;
}

const assets = new Map();
for (const m of assetsXml.matchAll(/<Asset>\s*<Template>([^<]*)<\/Template>\s*<Values>([\s\S]*?)<\/Values>\s*<\/Asset>/g)) {
  const guid = (m[2].match(/<GUID>(\d+)<\/GUID>/) || [])[1];
  if (guid) assets.set(guid, { tpl: m[1], body: m[2] });
}

// one property block, re-indented; null when empty
function prop(body, name) {
  const r = body.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
  if (!r || !/<[A-Za-z]/.test(r[1])) return null;
  return reindent('<' + name + '>' + r[1] + '</' + name + '>');
}

function reindent(xml) {
  const tokens = xml.replace(/>\s+</g, '><').split(/(?=<)/);
  const lines = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^<\//.test(t)) { depth--; lines.push('    '.repeat(depth) + t); continue; }
    // <a>text</a> on one line
    if (/^<[^/!][^>]*>[^<]+$/.test(t) && tokens[i + 1] && /^<\//.test(tokens[i + 1])) {
      lines.push('    '.repeat(depth) + t + tokens[i + 1]); i++; continue;
    }
    lines.push('    '.repeat(depth) + t);
    if (!/\/>$/.test(t)) depth++;
  }
  return lines;
}

function mirrorable(body) {
  const out = [];
  for (const p of PROPS) { const b = prop(body, p); if (b) out.push(b); }
  return out.some(b => b.some(l => SKIP.test(l))) ? null : out;
}

const items = [];
for (const [guid, { tpl, body }] of assets) {
  if (!/(Item|Specialist)/.test(tpl)) continue;
  const itemBlock = (body.match(/<Item>([\s\S]*?)<\/Item>/) || [])[1];
  if (itemBlock === undefined) continue;
  const alloc = (itemBlock.match(/^\s*<Allocation>([^<]*)/m) || [])[1] || tplAlloc[tpl];
  if (!ALLOC.has(alloc)) continue;
  if (/<ItemSet>/.test(itemBlock)) throw new Error(guid + ' already has an ItemSet');
  let blocks = mirrorable(body), source = 'passive';
  if (!blocks) continue;
  if (!blocks.length) {
    const ab = (body.match(/<ActiveBuff>(\d+)<\/ActiveBuff>/) || [])[1];
    if (ab && assets.has(ab) && assets.get(ab).tpl === 'VehicleBuff') { blocks = mirrorable(assets.get(ab).body); source = 'action ' + ab; }
  }
  if (!blocks || !blocks.length) continue;
  items.push({
    guid: +guid, tpl, alloc, source, blocks,
    name: (body.match(/<Name>([^<]*)<\/Name>/) || [])[1],
    icon: (body.match(/<IconFilename>([^<]*)<\/IconFilename>/) || [])[1],
  });
}
items.sort((a, b) => a.guid - b.guid);
if (items.length > MAX) throw new Error(items.length + ' items, GUID blocks only hold ' + MAX);

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/--/g, '- -');
const L = [];
const ind = (n, lines) => lines.forEach(l => L.push('    '.repeat(n) + l));

function trigger(guid, name, setGuid, buffGuid, on, other) {
  ind(2, [
    '<Asset>',
    '    <Template>Trigger</Template>',
    '    <Values>',
    '        <Standard>',
    `            <GUID>${guid}</GUID>`,
    `            <Name>${esc(name)}</Name>`,
    '        </Standard>',
    '        <Trigger>',
    '            <TriggerCondition>',
    '                <Template>ConditionPlayerCounter</Template>',
    '                <Values>',
    '                    <Condition />',
    '                    <ConditionPlayerCounter>',
    '                        <PlayerCounter>ItemSetsActive</PlayerCounter>',
    `                        <Context>${setGuid}</Context>`,
    '                        <CounterAmount>1</CounterAmount>',
    ...(on ? [] : ['                        <ComparisonOp>LessThan</ComparisonOp>']),
    '                    </ConditionPlayerCounter>',
    '                </Values>',
    '            </TriggerCondition>',
    '            <TriggerActions>',
    '                <Item>',
    '                    <TriggerAction>',
    '                        <Template>ActionBuff</Template>',
    '                        <Values>',
    '                            <Action />',
    '                            <ActionBuff>',
    `                                <BuffAsset>${buffGuid}</BuffAsset>`,
    `                                <AddBuff>${on ? 1 : 0}</AddBuff>`,
    '                            </ActionBuff>',
    '                        </Values>',
    '                    </TriggerAction>',
    '                </Item>',
    '                <Item>',
    '                    <TriggerAction>',
    '                        <Template>ActionRegisterTrigger</Template>',
    '                        <Values>',
    '                            <Action />',
    '                            <ActionRegisterTrigger>',
    `                                <TriggerAsset>${other}</TriggerAsset>`,
    '                            </ActionRegisterTrigger>',
    '                        </Values>',
    '                    </TriggerAction>',
    '                </Item>',
    '            </TriggerActions>',
    '        </Trigger>',
    '        <TriggerSetup>',
    `            <AutoRegisterTrigger>${on ? 1 : 0}</AutoRegisterTrigger>`,
    '            <UsedBySecondParties>0</UsedBySecondParties>',
    '        </TriggerSetup>',
    '    </Values>',
    '</Asset>',
  ]);
}

L.push('<ModOps>', '');
L.push('    <!-- Generated by .misc_data/tools/lighthouse_beacons/gen_beacons.js - edit the generator, not this file. -->');
L.push(`    <!-- ${items.length} vanilla ship/airship items: set ${BASE.set}+i, global buff ${BASE.buff}+i, on trigger ${BASE.on}+i, off trigger ${BASE.off}+i -->`);
L.push('');

// shared set buff: the real effect comes from the global ActionBuff, the set only marks the item as socketed
L.push('    <ModOp Type="addNextSibling" GUID="191146">');
ind(2, [
  '<Asset>',
  '    <Template>VehicleBuff</Template>',
  '    <Values>',
  '        <Standard>',
  `            <GUID>${SET_BUFF}</GUID>`,
  '            <Name>orient lighthouse beacon set marker</Name>',
  '            <IconFilename>data/graphics/icons/ornaments/lighthouse.png</IconFilename>',
  '        </Standard>',
  '        <Text>',
  `            <TextOverride>${LIGHTHOUSE}</TextOverride>`,
  '        </Text>',
  '        <Buff />',
  '        <ItemEffect />',
  '    </Values>',
  '</Asset>',
]);
items.forEach((it, i) => {
  ind(2, [
    '<Asset>',
    '    <Template>ItemSet</Template>',
    '    <Values>',
    '        <Standard>',
    `            <GUID>${BASE.set + i}</GUID>`,
    `            <Name>orient lighthouse beacon set: ${esc(it.name)}</Name>`,
    '            <IconFilename>data/graphics/icons/ornaments/lighthouse.png</IconFilename>',
    '        </Standard>',
    '        <ItemSocketSet>',
    `            <SetBuff>${SET_BUFF}</SetBuff>`,
    '            <BuffScope>Area</BuffScope>',
    '        </ItemSocketSet>',
    '        <Text>',
    `            <TextOverride>${LIGHTHOUSE}</TextOverride>`,
    '        </Text>',
    '        <Locked />',
    '    </Values>',
    '</Asset>',
  ]);
});
items.forEach((it, i) => {
  ind(2, [
    `<!-- ${it.guid} ${esc(it.name)} (${it.tpl}, ${it.alloc}, ${it.source}) -->`,
    '<Asset>',
    '    <Template>VehicleBuff</Template>',
    '    <Values>',
    '        <Standard>',
    `            <GUID>${BASE.buff + i}</GUID>`,
    `            <Name>orient lighthouse beacon: ${esc(it.name)}</Name>`,
    ...(it.icon ? [`            <IconFilename>${it.icon}</IconFilename>`] : []),
    '        </Standard>',
    '        <Text>',
    `            <TextOverride>${it.guid}</TextOverride>`,
    '        </Text>',
  ]);
  it.blocks.forEach(b => ind(4, b));
  ind(2, [
    '        <Buff />',
    '        <ItemEffect>',
    '            <EffectTargets>',
    ...TARGETS.flatMap(t => ['                <Item>', `                    <GUID>${t}</GUID>`, '                </Item>']),
    '            </EffectTargets>',
    '        </ItemEffect>',
    '    </Values>',
    '</Asset>',
  ]);
});
L.push('    </ModOp>', '');

L.push('    <ModOp Type="addNextSibling" GUID="130248">');
items.forEach((it, i) => {
  trigger(BASE.on + i, 'orient lighthouse beacon on: ' + it.name, BASE.set + i, BASE.buff + i, true, BASE.off + i);
  trigger(BASE.off + i, 'orient lighthouse beacon off: ' + it.name, BASE.set + i, BASE.buff + i, false, BASE.on + i);
});
L.push('    </ModOp>', '');

// set membership of the vanilla items
items.forEach((it, i) => {
  L.push(`    <ModOp Type="add" GUID="${it.guid}" Path="/Values/Item">`);
  L.push(`        <ItemSet>${BASE.set + i}</ItemSet>`);
  L.push('    </ModOp>');
});
L.push('');

// the completed lighthouse knows all sets
L.push(`    <ModOp Type="add" GUID="${LIGHTHOUSE}" Path="/Values/Culture">`);
L.push('        <Sets>');
items.forEach((it, i) => L.push('            <Item>', `                <Set>${BASE.set + i}</Set>`, '            </Item>'));
L.push('        </Sets>');
L.push('    </ModOp>', '');
L.push('</ModOps>');

fs.writeFileSync(OUT, L.join('\r\n') + '\r\n', 'utf8');
const bySrc = items.reduce((a, it) => (a[it.source.split(' ')[0]] = (a[it.source.split(' ')[0]] || 0) + 1, a), {});
console.log(items.length, 'items', bySrc, '->', path.relative(ROOT, OUT));
