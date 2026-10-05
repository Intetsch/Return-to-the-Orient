# Quest console commands — Return to the Orient

The command that starts a quest directly (from `textsourcelist.json`, class `CQuestManager`):

```
ts.Quests.StartQuestForCurrentPlayerNet(questGUID)
```

> *"Does the same as StartQuest(int questGUID) or StartQuestLine(int questLineGUID) depending on
> the given GUID but without return value and for the currently active session"*

`Quests` is a static root alias exactly like `Conditions` and `Participants`, so the long form
`TextSources.TextSourceRoots.Quests.StartQuestForCurrentPlayerNet(GUID)` works too.

Be in the Orient session with the right resident population present — the quest still needs its
giver (Envoy / Nomad / Elder) and any target buildings to exist, or it will start and immediately
fail to find its objects.

---

## Envoy quests (giver 1404000019 — Envoy resident)

### Honoured Guests (Envoy Nureddin Efendi)
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001275)   # 1 Matters of Protocol (decision)
ts.Quests.StartQuestForCurrentPlayerNet(1404001290)   # 2 Horns of Honour — find wild bulls (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001652)   # 3 A Suitable Match — find Leyla at the mosque (select)
```

### Young Masters (Envoy Selim Efendi)
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001304)   # 1 Trinkets from the West (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001662)   # 2 Lessons of the Realm (picture puzzle + select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001321)   # 3 The Forged Seal (photo at the mosque)
```

### Diwan Intrigues (Envoy Kemal Bey)
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001330)   # 1 The Speech (decision)
ts.Quests.StartQuestForCurrentPlayerNet(1404001351)   # 2 White Pebbles — Town Hall (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001358)   # 3 The Shadow — follow Tariq Bey (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001376)   # 4 Stern Decrees (sustain + build)
```

### A Pasha's Legacy (Envoy Faruq Pasha)
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001381)   # 1 Tiles of Glory — 20t mosaic (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001387)   # 2 Gated Paradise — beggars at the mosque (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001397)   # 3 The Soup Kitchen — 5t dates + Consulate (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001405)   # 4 Festive Splendour — Eid pavilion: palm planks, silk, rugs (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001412)   # 5 Penance — Nomad houses (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001426)   # 6 The Fast — marzipan (sustain)
```

### Standalone envoy quests
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001436)   # A Thousand and One Lapses (decision)
ts.Quests.StartQuestForCurrentPlayerNet(1404001455)   # Burning the Midnight Oil — 8t chandeliers (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001459)   # The Inspector's Visit (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001465)   # Bad News Travels Fast (riot)
ts.Quests.StartQuestForCurrentPlayerNet(1404001470)   # Tea Diplomacy — 7t spiced tea (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001474)   # A Physician for the Consulate — hospital (build)
ts.Quests.StartQuestForCurrentPlayerNet(1404001480)   # A Reception at Kahina's — Madame Kahina's Harbour (transport)
ts.Quests.StartQuestForCurrentPlayerNet(1404001504)   # Sons Abroad — students in the Old World (select)
```

## Nomad quests (giver 1404000018 — Nomad resident)

```
ts.Quests.StartQuestForCurrentPlayerNet(1404001532)   # The Desert in Bloom (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001541)   # The Tax Farmer (use item / select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001556)   # Coming of Age — Left Behind (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001563)   # Coming of Age — The Lion's Den (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001572)   # Coming of Age — The Runaway (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001580)   # Coming of Age — A Feast in His Honour — dates + pomegranate juice (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001588)   # Little Jerboas (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001594)   # The Old Ones of the Clan — 10t pomegranate juice (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001598)   # Up the Palm (gift)
ts.Quests.StartQuestForCurrentPlayerNet(1404001608)   # The Bell Goat (photo)
ts.Quests.StartQuestForCurrentPlayerNet(1404001615)   # Goats in the Archive (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001621)   # Zootopic — Old World zoo (photo)
ts.Quests.StartQuestForCurrentPlayerNet(1404001629)   # Desert Verse — qasida to Madame Kahina (transport / pickup object)
```

---

## Helpers

Quest pool GUIDs:

| GUID | Pool |
|------|------|
| 1404001272 | RQ_AllQuest_ParentPoolOrient |
| 1404001273 | OrientQuests_Nomad_Pool |
| 1404001274 | OrientQuests_Envoy_Pool |

```
ts.Quests.CheatEndPoolCooldownNet(1404001274)              # skip envoy pool cooldown
ts.Quests.CheatEndPoolCooldownNet(1404001273)              # skip nomad pool cooldown
ts.Quests.CheatEndQuestTimerNet(questGUID)                 # cut a quest's delay/latency timer to 0
ts.Quests.CheatEndQuestBlockingNet(poolGUID, questGUID)    # stop a pool blocking on a quest
ts.Quests.ReachSelectedQuest()                             # instantly complete the tracked quest
ts.Quests.RunningQuestByGUID(questGUID)                    # inspect a running instance
ts.Quests.DebugQuestGUID(questGUID)                        # point the debug page at a quest
ts.Quests.ResetTutorialQuestsNet()
```

Sub-quests inside *Ruining A Reputation* (`TriggerQuest` assets, fired from the parent — not meant
to be started standalone): 1404001359, 1404001360, 1404001361.

## Chain prerequisites (quest must be Reached first)

| Quest | Needs |
|------|------|
| 1290 Horns of Honour | 1275 Matters of Protocol |
| 1652 A Suitable Match | 1290 Horns of Honour + a Mosque in the area |
| 1662 Lessons of the Realm | 1304 Trinkets from the West + Carpet Workshop, Date Plantation, Camel Farm in the area |
| 1321 The Forged Seal | 1662 Lessons of the Realm + a Mosque in the area |
| 1351 White Pebbles | 1330 The Speech + Town Hall in the area |
| 1358 The Shadow | 1351 White Pebbles + Town Hall in the area + a Marketplace in the session |
| 1376 Stern Decrees | 1358 The Shadow |
| 1412 Penance | 1405 Festive Splendour + 3 Nomad houses in the area |
| 1426 The Fast | 1412 Penance + Rose Water and Marzipan unlocked |
| 1563 The Lion's Den | 1556 Left Behind + an Envoy house in the area |
| 1572 The Runaway | 1563 The Lion's Den + a Date Plantation in the area |
| 1580 A Feast in His Honour | 1572 The Runaway |

The vanilla Enbesa follow-up quests these were cut from (Ukuli Bula 2/3, Moot Points 4/6, Man Up 2/3/6/8/10, ...) are no longer started.
