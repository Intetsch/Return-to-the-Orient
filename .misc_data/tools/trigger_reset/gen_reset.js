// Generates Natoncy_orient_trigger_reset/data/config/export/main/asset/assets.xml (CRLF).
// Usage (from the repo root): node .misc_data/tools/trigger_reset/gen_reset.js
// When a new progression trigger is added, put it into `tiers` in tier order and regenerate.
const fs = require('fs');
const STEP = 1000; // ms between two re-registrations
const tiers = [
  ['1404000792', '1.0'],
  ['1404000814', '1.1'], ['1404000815', '1.2'], ['1404000816', '1.3'], ['1404000817', '1.4'],
  ['1404000818', '2.0'], ['1404000819', '2.1'],
  ['1404001016', '2.2'], ['1404001260', '2.2 Biscuits'], ['1404001269', '2.2 Ice Cream'],
  ['1404000820', '2.3'], ['1404001270', '2.3 Ice Cream'], ['1404001261', '2.3 Typewriters'], ['1404001262', '2.3 Fans'],
  ['1404000821', '2.4'], ['1404001263', '2.4 Typewriters'], ['1404001264', '2.4 Fans'], ['1404001265', '2.4 Steam Carriages'], ['1404001266', '2.4 Scooters'],
  ['1404000822', '2.5'], ['1404001267', '2.5 Steam Carriages'], ['1404001268', '2.5 Scooters'],
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

function subTrigger(base, conditionLines) {
  return block(base, [
    `<Item>`,
    `    <SubTrigger>`,
    `        <Template>AutoCreateTrigger</Template>`,
    `        <Values>`,
    `            <Trigger>`,
    `                <TriggerCondition>`,
    ...conditionLines.map((l) => '                    ' + l),
    `                </TriggerCondition>`,
    `            </Trigger>`,
    `        </Values>`,
    `    </SubTrigger>`,
    `</Item>`,
  ]);
}

const sessionEnter = [
  `<Template>ConditionEvent</Template>`,
  `<Values>`,
  `    <Condition />`,
  `    <ConditionEvent>`,
  `        <ConditionEvent>SessionEnter</ConditionEvent>`,
  `    </ConditionEvent>`,
  `    <ConditionPropsNegatable />`,
  `</Values>`,
];

const creativeMode = (negate) => [
  `<Template>ConditionIsCreativeMode</Template>`,
  `<Values>`,
  `    <Condition />`,
  `    <ConditionIsCreativeMode />`,
  ...(negate
    ? [`    <ConditionPropsNegatable>`, `        <NegateCondition>1</NegateCondition>`, `    </ConditionPropsNegatable>`]
    : [`    <ConditionPropsNegatable />`]),
  `</Values>`,
];

function trigger(guid, name, subs, actions) {
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
      `                <Template>ConditionActiveSession</Template>`,
      `                <Values>`,
      `                    <Condition />`,
      `                    <ConditionActiveSession>`,
      `                        <ActiveSession>1404000000</ActiveSession>`,
      `                    </ConditionActiveSession>`,
      `                    <ConditionPropsNegatable />`,
      `                </Values>`,
      `            </TriggerCondition>`,
      `            <SubTriggers>`,
    ]),
    subs,
    block(8, [
      `            </SubTriggers>`,
      `            <TriggerActions>`,
    ]),
    actions,
    block(8, [
      `                <Item>`,
      `                    <TriggerAction>`,
      `                        <Template>ActionResetTrigger</Template>`,
      `                        <Values>`,
      `                            <Action />`,
      `                            <ActionResetTrigger />`,
      `                        </Values>`,
      `                    </TriggerAction>`,
      `                </Item>`,
      `            </TriggerActions>`,
      `            <ResetTrigger>`,
      `                <IsBaseAutoCreateAsset>1</IsBaseAutoCreateAsset>`,
      `                <Values>`,
      `                    <EmptyAutoCreateValue />`,
      `                </Values>`,
      `            </ResetTrigger>`,
      `        </Trigger>`,
      `        <TriggerSetup>`,
      `            <UsedBySecondParties>0</UsedBySecondParties>`,
      `        </TriggerSetup>`,
      `    </Values>`,
      `</Asset>`,
    ]),
  ].join('\n');
}

const normalSteps = tiers.map(([g, l], i) => step(g, `Intermediate Orient ${l}`, (i + 1) * STEP, 24)).join('\n');
const creativeSteps = step('1404000791', 'InitCreativeMode-Orient', STEP, 24);

const out = [
  `<ModOps>`,
  ``,
  `    <!-- Re-runs the Orient unlock triggers every time the player enters the Orient session.`,
  `         A fired trigger is gone from the savegame, and it expanded its pools when it fired.`,
  `         Buildings that a later update adds to such a pool therefore stay locked in older saves.`,
  `         ActionRegisterTrigger registers a fired trigger again (or re-creates a pending one), so it fires`,
  `         again with the current pool contents as soon as its population condition is met.`,
  ``,
  `         The triggers run one after another in tier order, ${STEP} ms apart, like normal progression.`,
  `         Add new progression triggers here too. -->`,
  `    <ModOp Type="addNextSibling" GUID="10138">`,
  ``,
  `        <!-- Normal games: re-run all progression triggers in tier order -->`,
  trigger('1404004000', 'Orient trigger reset on session enter', [subTrigger(24, sessionEnter), subTrigger(24, creativeMode(true))].join('\n'), normalSteps),
  ``,
  `        <!-- Creative games: the creative trigger unlocks everything, so re-running it is enough -->`,
  trigger('1404004001', 'Orient creative trigger reset on session enter', [subTrigger(24, sessionEnter), subTrigger(24, creativeMode(false))].join('\n'), creativeSteps),
  ``,
  `    </ModOp>`,
  ``,
  `</ModOps>`,
  ``,
].join('\n');

const target = process.argv[2] || require('path').join(__dirname, '../../../Natoncy_orient_trigger_reset/data/config/export/main/asset/assets.xml');
fs.writeFileSync(target, out.replace(/\r?\n/g, '\r\n'));
console.log('written', target);
