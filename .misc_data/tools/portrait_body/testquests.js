// Generates two portrait test quests (Nomad, Envoy): "deliver 5t of Dates to your trading post", given by the
// Nomads / Envoys profiles, so the quest log shows the giver's portrait. Modelled on vanilla 102187
// (A7_QuestDeliveryObject, starts immediately, no starter object, delivery to the player's kontor).
// Also writes the English and German texts (replacing any earlier entries in 1404003700-1404003719).
// usage: node testquests.js <mod root>
const fs = require('fs');
const MOD = process.argv[2];
const QDIR = `${MOD}/data/config/export/main/asset/assets_includes/test_quests`;
const DATES = 1888999749, AMOUNT = 5;   // Shared_Date (Satanoy)
const OBJECTIVE_TEXT = 13014;           // vanilla: "Provide the resident with: <amount>t <product>"
const BLOCK = [1404003700, 1404003719];

const SPECS = [
  {
    key: 'Nomad', base: 1404003700, profile: 1404000018,
    icon: 'data/ui/2kimages/main/profiles/orient_portrait_nomad.png',
    voice: { start: 1404000390, success: 1404000448, aborted: 1404000416 },
    en: ['Portrait Test: Dates for the Nomad',
      'A nomad family has run out of dates on the long road through the desert. Bring 5 tons of dates to your trading post and they will gladly collect them there. (Test quest for the Nomad portrait.)',
      'A nomad asks you for 5 tons of dates.',
      'The nomad thanks you for the dates.',
      'The nomad is disappointed that you gave up.'],
    de: ['Porträttest: Datteln für den Nomaden',
      'Einer Nomadenfamilie sind auf dem langen Weg durch die Wüste die Datteln ausgegangen. Bringt 5 Tonnen Datteln zu Eurem Kontor, dort holen sie sie gern ab. (Testquest für das Nomaden-Porträt.)',
      'Ein Nomade bittet Euch um 5 Tonnen Datteln.',
      'Der Nomade dankt Euch für die Datteln.',
      'Der Nomade ist enttäuscht, dass Ihr aufgegeben habt.'],
  },
  {
    key: 'Envoy', base: 1404003710, profile: 1404000019,
    icon: 'data/ui/2kimages/main/profiles/orient_portrait_envoy.png',
    voice: { start: 1404000467, success: 1404000523, aborted: 1404000493 },
    en: ['Portrait Test: Dates for the Envoy',
      "An envoy is expecting guests from the Sultan's court and cannot serve them without dates. Bring 5 tons of dates to your trading post. (Test quest for the Envoy portrait.)",
      'An envoy asks you for 5 tons of dates.',
      'The envoy thanks you for the dates.',
      'The envoy is outraged that you gave up.'],
    de: ['Porträttest: Datteln für den Gesandten',
      'Ein Gesandter erwartet Gäste vom Hof des Sultans und kann ihnen ohne Datteln nichts anbieten. Bringt 5 Tonnen Datteln zu Eurem Kontor. (Testquest für das Gesandten-Porträt.)',
      'Ein Gesandter bittet Euch um 5 Tonnen Datteln.',
      'Der Gesandte dankt Euch für die Datteln.',
      'Der Gesandte ist empört, dass Ihr aufgegeben habt.'],
  },
];
// offsets from base: 0 quest, 1 story text, 2 start notification, 3 success notification, 4 aborted notification
const TEXT_NAMES = ['Delivery', 'Story', 'Started', 'Delivered', 'Aborted'];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MESSAGES = ['StarterMessage', 'SuccessMessage', 'FailureMessage', 'SelectionReminderMessage', 'AbortedManuallyMessage',
  'AbortedAutomaticallyMessage', 'InvitationMessage', 'EscortShipSelectedMessage', 'ReminderMessage', 'ResolveConfirmationMessage',
  'InvitationSmugglerQuestMessage', 'SmugglerQuestTradingStationReached', 'StartInvitationGiveItemMessage', 'StartFollowShipMessage'];
const HOOKS = ['OnQuestStart', 'OnQuestDeclined', 'OnQuestActive', 'OnQuestAborted', 'OnQuestTimedOut', 'OnActiveQuestTimedOut',
  'OnQuestFailed', 'OnQuestDiscarded', 'OnQuestSucceeded', 'OnQuestEnd'];

const pad = n => ' '.repeat(n);
function notification(tag, n, ind) {
  const p = pad(ind);
  const head = [`${p}<${tag}>`, `${p}  <Notification>`, `${p}    <IsBaseAutoCreateAsset>1</IsBaseAutoCreateAsset>`, `${p}    <Values>`];
  const tail = [`${p}    </Values>`, `${p}  </Notification>`];
  if (!n) return [...head, `${p}      <CharacterNotification />`, `${p}      <BaseNotification />`, `${p}      <NotificationSubtitle />`, ...tail,
    `${p}  <SuppressMessage>1</SuppressMessage>`, `${p}</${tag}>`];
  return [...head, `${p}      <CharacterNotification>`, `${p}        <Profile>${n.profile}</Profile>`, `${p}      </CharacterNotification>`,
    `${p}      <BaseNotification>`, `${p}        <NotificationText>${n.text}</NotificationText>`, `${p}        <DisplayTimeout>90000</DisplayTimeout>`,
    `${p}      </BaseNotification>`, `${p}      <NotificationSubtitle>`, `${p}        <Subtitle>${n.subtitle}</Subtitle>`, `${p}      </NotificationSubtitle>`,
    ...tail, `${p}</${tag}>`];
}
const emptyHook = (tag, ind) => { const p = pad(ind); return [`${p}<${tag}>`, `${p}  <IsBaseAutoCreateAsset>1</IsBaseAutoCreateAsset>`, `${p}  <Values>`, `${p}    <ActionList />`, `${p}  </Values>`, `${p}</${tag}>`]; };
const inherit0 = (template, ind) => { const p = pad(ind); return [`${p}<VectorElement>`, `${p}  <InheritedIndex>0</InheritedIndex>`, `${p}  <InheritanceMapV2>`,
  `${p}    <Entry>`, `${p}      <TemplateName>${template}</TemplateName>`, `${p}      <Index>0</Index>`, `${p}    </Entry>`, `${p}  </InheritanceMapV2>`, `${p}</VectorElement>`]; };

function deliveryQuest(s) {
  const g = k => s.base + k, P = pad(16), Q = pad(20);
  const msgs = {
    StarterMessage: { profile: s.profile, text: g(2), subtitle: s.voice.start },
    SuccessMessage: { profile: s.profile, text: g(3), subtitle: s.voice.success },
    AbortedManuallyMessage: { profile: s.profile, text: g(4), subtitle: s.voice.aborted },
  };
  const L = ['        <Asset>', '            <Template>A7_QuestDeliveryObject</Template>', '            <Values>',
    `${P}<Standard>`, `${P}    <GUID>${g(0)}</GUID>`, `${P}    <Name>Test_Portrait_${s.key}_Delivery</Name>`, `${P}</Standard>`, `${P}<Quest>`];
  for (const m of MESSAGES) L.push(...notification(m, msgs[m], 20));
  for (const h of HOOKS) L.push(...emptyHook(h, 20));
  L.push(`${Q}<QuestGiver>${s.profile}</QuestGiver>`, `${Q}<StoryText>${g(1)}</StoryText>`, `${Q}<CountForQuestLimit>0</CountForQuestLimit>`,
    `${Q}<QuestTimeLimit>0</QuestTimeLimit>`, `${Q}<QuestActivation>QuestStart</QuestActivation>`, `${Q}<IsAbortable>1</IsAbortable>`,
    `${Q}<QuestTrackerVisibility>Global</QuestTrackerVisibility>`, `${Q}<HasExclusiveQuestGiver>0</HasExclusiveQuestGiver>`,
    `${Q}<QuestBookBackground>data/ui/2kimages/main/assets16/questbackground/bg_questbook_landoflions.png</QuestBookBackground>`,
    `${Q}<HasReminderMessage>0</HasReminderMessage>`, `${P}</Quest>`,
    `${P}<PreConditionList>`, `${P}    <Condition>`, `${P}        <IsBaseAutoCreateAsset>1</IsBaseAutoCreateAsset>`, `${P}        <Values>`,
    `${P}            <Condition />`, `${P}            <ConditionAlwaysTrue />`, `${P}        </Values>`, `${P}    </Condition>`, `${P}</PreConditionList>`,
    `${P}<Text>`, `${P}    <LocaText>`, `${P}        <English>`, `${P}            <Text>${esc(s.en[0])}</Text>`, `${P}            <Status>Exported</Status>`,
    `${P}        </English>`, `${P}    </LocaText>`, `${P}</Text>`,
    `${P}<Reward>`, `${P}    <RewardAssets />`, `${P}    <RewardReputation />`, `${P}</Reward>`,
    `${P}<Objectives>`, `${P}    <WinConditions>`, `${P}        <Item>`, ...inherit0('A7_QuestDeliveryObject', 28),
    `${P}            <Objective>`, `${P}                <IsBaseAutoCreateAsset>1</IsBaseAutoCreateAsset>`, `${P}                <Values>`,
    `${P}                    <ConditionQuestDelivery>`, `${P}                        <DeliveryObject_cqd>`, `${P}                            <Item>`,
    ...inherit0('DeliveryObjective', 48),
    `${P}                                <ObjectGUID>${DATES}</ObjectGUID>`, `${P}                                <Min>${AMOUNT}</Min>`, `${P}                                <Max>${AMOUNT}</Max>`,
    `${P}                            </Item>`, `${P}                        </DeliveryObject_cqd>`,
    `${P}                        <DeliveryExecutionPlace>`, `${P}                            <Template>ConditionObjectPlayerKontor</Template>`, `${P}                            <Values>`,
    `${P}                                <ConditionObjectPlayerKontor />`, `${P}                                <ConditionScanner />`, `${P}                                <ConditionObjectiveSignsAndFeedback />`,
    `${P}                            </Values>`, `${P}                        </DeliveryExecutionPlace>`, `${P}                        <ConfirmOnReach>0</ConfirmOnReach>`,
    `${P}                    </ConditionQuestDelivery>`, `${P}                    <ConditionQuestObjective>`,
    `${P}                        <TextCombinedContextValue>${OBJECTIVE_TEXT}</TextCombinedContextValue>`,
    `${P}                        <QuestTrackerIcon>${s.icon}</QuestTrackerIcon>`,
    `${P}                        <LinkAllQuestActionsToQuest>1</LinkAllQuestActionsToQuest>`, `${P}                    </ConditionQuestObjective>`,
    `${P}                    <ObjectiveScaling />`, `${P}                    <ConditionPropsSessionSettings />`,
    `${P}                </Values>`, `${P}            </Objective>`, `${P}        </Item>`, `${P}    </WinConditions>`, `${P}</Objectives>`,
    `${P}<QuestOptional>`, `${P}    <HasStarterObject>None</HasStarterObject>`, `${P}</QuestOptional>`,
    '            </Values>', '        </Asset>');
  return L;
}
function textAsset(guid, name, en) {
  return ['        <Asset>', '            <Template>Text</Template>', '            <Values>', '                <Standard>', `                    <GUID>${guid}</GUID>`,
    `                    <Name>${name}</Name>`, '                </Standard>', '                <Text>', '                    <LocaText>', '                        <English>',
    `                            <Text>${esc(en)}</Text>`, '                            <Status>Exported</Status>', '                        </English>',
    '                    </LocaText>', '                </Text>', '            </Values>', '        </Asset>'];
}

const out = ['<ModOps>', '', '    <!-- Portrait test quests: deliver 5t of Dates to your trading post. Start them from the console:',
  ...SPECS.map(s => `         ts.Quests.StartQuestForCurrentPlayerNet(${s.base})   (${s.key})`), '    -->'];
for (const s of SPECS) {
  out.push('    <ModOp Type="addNextSibling" GUID="102187">', ...deliveryQuest(s), '');
  for (let k = 1; k < TEXT_NAMES.length; k++) out.push(...textAsset(s.base + k, `Test_Portrait_${s.key}_${TEXT_NAMES[k]}`, s.en[k]));
  out.push('    </ModOp>', '');
}
out.push('</ModOps>');
fs.mkdirSync(QDIR, { recursive: true });
fs.writeFileSync(`${QDIR}/assets_test_portrait_quests.xml`, out.join('\r\n') + '\r\n');
fs.writeFileSync(`${QDIR}/assets__index.xml`, ['<ModOps>', '', '    <Include File="assets_test_portrait_quests.xml" />', '', '</ModOps>'].join('\r\n'));

// texts: drop earlier entries of the block, insert the new ones sorted by GUID; keep BOM / CRLF / no newline at EOF
const templ = k => (k === 0 ? 'A7_QuestDeliveryObject' : 'Text');
for (const [lang, file] of [['en', 'texts_english.xml'], ['de', 'texts_german.xml']]) {
  const p = `${MOD}/data/config/gui/${file}`;
  let t = fs.readFileSync(p, 'utf8');
  const before = t.length;
  t = t.replace(/    <Text>\r\n      <GUID>(\d+)<\/GUID>\r\n[\s\S]*?    <\/Text>\r\n/g, (m, g) => (+g >= BLOCK[0] && +g <= BLOCK[1] ? '' : m));
  const removed = before !== t.length;
  let n = 0;
  for (const s of SPECS) for (let k = 0; k < TEXT_NAMES.length; k++) {
    const guid = s.base + k;
    const block = ['    <Text>', `      <GUID>${guid}</GUID>`, `      <!-- ${templ(k)} | ${s.en[k]} | ${s.en[k]} -->`, `      <Text>${esc(s[lang][k])}</Text>`, '    </Text>'].join('\r\n');
    const re = /    <Text>\r\n      <GUID>(\d+)<\/GUID>/g; let m, at = -1;
    while ((m = re.exec(t))) if (+m[1] > guid) { at = m.index; break; }
    if (at < 0) at = t.lastIndexOf('  </ModOp>');
    t = t.slice(0, at) + block + '\r\n' + t.slice(at); n++;
  }
  fs.writeFileSync(p, t, 'utf8');
  console.log(file, removed ? 'replaced old block,' : '', 'added', n);
}
console.log('quests written to', QDIR);
