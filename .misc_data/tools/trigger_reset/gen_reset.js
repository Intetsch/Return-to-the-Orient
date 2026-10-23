// Generates Natoncy_orient_trigger_reset/data/config/export/main/asset/assets.xml (CRLF).
// Usage (from the repo root): node .misc_data/tools/trigger_reset/gen_reset.js
// When a new progression trigger is added, put it into `tiers` in tier order and regenerate.
// Regenerate for every release too: the reset runs once per save for each main mod version.
const fs = require('fs');
const path = require('path');
const STEP = 1000; // ms between two re-registrations
const tiers = [
  ['1404000792', '1.0'],
  ['1404000814', '1.1'], ['1404000815', '1.2'], ['1404000816', '1.3'], ['1404000817', '1.4'],
  ['1404000818', '2.0'], ['1404004010', '2.0 Roasted Chickpeas'], ['1404004012', '2.0 Hummus'],
  ['1404000819', '2.1'], ['1404004011', '2.1 Roasted Chickpeas'], ['1404004013', '2.1 Hummus'], ['1404004014', '2.1 Candied Dates'],
  ['1404001016', '2.2'], ['1404001260', '2.2 Biscuits'], ['1404001269', '2.2 Ice Cream'],
  ['1404004015', '2.2 Candied Dates'], ['1404004016', '2.2 Spiced Tea'], ['1404004018', '2.2 Arak'],
  ['1404000820', '2.3'], ['1404001270', '2.3 Ice Cream'], ['1404001261', '2.3 Typewriters'], ['1404001262', '2.3 Fans'],
  ['1404004017', '2.3 Spiced Tea'], ['1404004019', '2.3 Arak'], ['1404004020', '2.3 Lokum'],
  ['1404000821', '2.4'], ['1404001263', '2.4 Typewriters'], ['1404004024', '2.4 Typewriters Engineers'],['1404001264', '2.4 Fans'], ['1404001265', '2.4 Steam Carriages'], ['1404001266', '2.4 Scooters'],
  ['1404004021', '2.4 Lokum'], ['1404004022', '2.4 Incense'],
  ['1404000822', '2.5'], ['1404001267', '2.5 Steam Carriages'], ['1404001268', '2.5 Scooters'], ['1404004023', '2.5 Incense'],
  ['1404000823', '2.6'], ['1404000824', '2.7'], ['1404000825', '2.8'],
  ['1404001156', '3.0'], ['1404001157', '3.1'], ['1404001158', '3.2'], ['1404001159', '3.3'], ['1404001160', '3.4'], ['1404001161', '3.5'],
];

const pad = (n) => ' '.repeat(n);
const block = (base, lines) => lines.map((l) => pad(base) + l).join('\n');

function step(guid, comment, delay, base) {
  return block(base, [
    `<!-- ${comment} -->`,
    `<Item>`,
    `    <TriggerAction>`,
    `        <Template>ActionDelayedActions</Template>`,
    `        <Values>`,
    `            <Action />`,
    `            <ActionDelayedActions>`,
    `                <ExecutionDelay>${delay}</ExecutionDelay>`,
    `                <DelayedActions>`,
    `                    <IsBaseAutoCreateAsset>1</IsBaseAutoCreateAsset>`,
    `                    <Values>`,
    `                        <ActionList>`,
    `                            <Actions>`,
    `                                <Item>`,
    `                                    <Action>`,
    `                                        <Template>ActionRegisterTrigger</Template>`,
    `                                        <Values>`,
    `                                            <Action />`,
    `                                            <ActionRegisterTrigger>`,
    `                                                <TriggerAsset>${guid}</TriggerAsset>`,
    `                                            </ActionRegisterTrigger>`,
    `                                        </Values>`,
    `                                    </Action>`,
    `                                </Item>`,
    `                            </Actions>`,
    `                        </ActionList>`,
    `                    </Values>`,
    `                </DelayedActions>`,
    `            </ActionDelayedActions>`,
    `        </Values>`,
    `    </TriggerAction>`,
    `</Item>`,
  ]);
}

function register(guid, comment, unregister, base) {
  return block(base, [
    `<!-- ${comment} -->`,
    `<Item>`,
    `    <TriggerAction>`,
    `        <Template>ActionRegisterTrigger</Template>`,
    `        <Values>`,
    `            <Action />`,
    `            <ActionRegisterTrigger>`,
    `                <TriggerAsset>${guid}</TriggerAsset>`,
    ...(unregister ? [`                <UnregisterTrigger>1</UnregisterTrigger>`] : []),
    `            </ActionRegisterTrigger>`,
    `        </Values>`,
    `    </TriggerAction>`,
    `</Item>`,
  ]);
}

// IsBaseAutoCreateAsset means the template default, which is ConditionAlwaysTrue for triggers
const condition = (template) => [
  template === 'ConditionAlwaysTrue' ? `<IsBaseAutoCreateAsset>1</IsBaseAutoCreateAsset>` : `<Template>${template}</Template>`,
  `<Values>`,
  `    <Condition />`,
  `    <${template} />`,
  `</Values>`,
];

// `actions` is already indented for its place inside <TriggerActions>
function trigger(guid, name, autoRegister, conditionTemplate, actions) {
  return [
    block(8, [
      `<Asset>`,
      `    <Template>Trigger</Template>`,
      `    <Values>`,
      `        <Standard>`,
      `            <GUID>${guid}</GUID>`,
      `            <Name>${name}</Name>`,
      `        </Standard>`,
      `        <Trigger>`,
      `            <TriggerCondition>`,
      ...condition(conditionTemplate).map((l) => '                ' + l),
      `            </TriggerCondition>`,
      ...(actions ? [`            <TriggerActions>`] : []),
    ]),
    ...(actions ? [actions, block(8, [`            </TriggerActions>`])] : []),
    block(8, [
      `        </Trigger>`,
      `        <TriggerSetup>`,
      ...(autoRegister ? [] : [`            <AutoRegisterTrigger>0</AutoRegisterTrigger>`]),
      `            <UsedBySecondParties>0</UsedBySecondParties>`,
      `        </TriggerSetup>`,
      `    </Values>`,
      `</Asset>`,
    ]),
  ].join('\n');
}

// One run trigger per main mod version: a trigger that is new to a save registers itself on load and
// fires once, so the reset runs exactly once per save after each update. x.y.z -> 1404006000 + 100x + 10y + z.
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../modinfo.json'), 'utf8')).Version;
const [major, minor, patch] = version.split('.').map(Number);
if (minor > 9 || patch > 9 || major > 9) throw new Error(`version ${version} does not fit the run GUID scheme`);
const RUN_GUID = 1404006000 + major * 100 + minor * 10 + patch;
const BODY_GUID = '1404004003';

const bodySteps = [
  ...tiers.map(([g, l], i) => step(g, `Intermediate Orient ${l}`, (i + 1) * STEP, 24)),
  // Creative games: the creative trigger unlocks everything. It stays pending in normal games anyway.
  step('1404000791', 'InitCreativeMode-Orient', (tiers.length + 1) * STEP, 24),
].join('\n');

const runActions = [
  // Older saves still hold the repeating resets (session enter, then noria selection) with their
  // own copy of the actions. Drop them, otherwise they keep firing.
  register('1404004000', 'Old repeating reset', true, 24),
  register('1404004001', 'Old repeating creative reset', true, 24),
  register('1404004002', 'Old upgrade to noria selection', true, 24),
  register(BODY_GUID, 'Re-run all progression triggers', false, 24),
].join('\n');

const out = [
  `<ModOps>`,
  ``,
  `    <!-- Re-runs the Orient unlock triggers once per save after every update of the main mod.`,
  `         A fired trigger is gone from the savegame, and it expanded its pools when it fired.`,
  `         Buildings that a later update adds to such a pool therefore stay locked in older saves.`,
  `         ActionRegisterTrigger registers a fired trigger again (or re-creates a pending one), so it fires`,
  `         again with the current pool contents as soon as its population condition is met.`,
  ``,
  `         The triggers run one after another in tier order, ${STEP} ms apart, like normal progression.`,
  `         Add new progression triggers here too. -->`,
  `    <ModOp Type="addNextSibling" GUID="10138">`,
  ``,
  `        <!-- Fires once per save for main mod version ${version} -->`,
  trigger(RUN_GUID, `Orient trigger reset run ${version}`, true, 'ConditionAlwaysTrue', runActions),
  ``,
  `        <!-- Only runs when registered by a run trigger -->`,
  trigger(BODY_GUID, 'Orient trigger reset', false, 'ConditionAlwaysTrue', bodySteps),
  ``,
  `        <!-- Retired repeating resets, kept so older saves that still hold them can unregister them -->`,
  trigger('1404004000', 'Orient trigger reset (retired)', false, 'ConditionAlwaysFalse', null),
  trigger('1404004001', 'Orient creative trigger reset (retired)', false, 'ConditionAlwaysFalse', null),
  trigger('1404004002', 'Orient trigger reset upgrade (retired)', false, 'ConditionAlwaysFalse', null),
  ``,
  `    </ModOp>`,
  ``,
  `</ModOps>`,
  ``,
].join('\n');

const target = process.argv[2] || path.join(__dirname, '../../../Natoncy_orient_trigger_reset/data/config/export/main/asset/assets.xml');
fs.writeFileSync(target, out.replace(/\r?\n/g, '\r\n'));
console.log('written', target, 'run trigger', RUN_GUID);
