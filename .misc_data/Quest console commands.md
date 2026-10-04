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

### Tradition Keeper (Envoy Nureddin Efendi)
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001275)   # 1 Courtesy of the Guest (decision)
ts.Quests.StartQuestForCurrentPlayerNet(1404001290)   # 2 Horns of Contention — find wild bulls (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001652)   # 5 The Arranged Match — find Leyla at the mosque (select)
```

### Kids Nowadays (Envoy Selim Efendi)
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001304)   # 1 How the Envoy Stole Eid (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001662)   # 2 Idle Hands (picture puzzle + select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001321)   # 3 Public Repentance (photo at the mosque)
```

### Divan Affairs (Envoy Kemal Bey)
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001330)   # 1 The Speech (decision)
ts.Quests.StartQuestForCurrentPlayerNet(1404001351)   # 2 The Vote — Town Hall (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001358)   # 3 The Smear — tail Tariq Bey (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001376)   # 5 Stern Decrees (sustain + build)
```

### Highborn (Envoy Faruq Pasha)
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001381)   # 1 Tiles of Glory — 20t mosaic (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001387)   # 2 Gated Paradise — beggars at the mosque (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001397)   # 3 Benefaction — 5t dates + Consulate (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001405)   # 4a Festive Splendour — Eid pavilion: palm planks, silk, rugs (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001412)   # 5 Penance — Nomad houses (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001426)   # 6 Tolerance — marzipan fast (sustain)
```

### Standalone envoy quests
```
ts.Quests.StartQuestForCurrentPlayerNet(1404001436)   # A Thousand and One Lapses (decision)
ts.Quests.StartQuestForCurrentPlayerNet(1404001455)   # Light for the Madrasa — 8t chandeliers (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001459)   # Vexing Detritus (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001465)   # Unrest Among the Tents (riot)
ts.Quests.StartQuestForCurrentPlayerNet(1404001470)   # Tea for the Divan — 7t spiced tea (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001474)   # Clean Sheets, Soft Drapes — hospital (build)
ts.Quests.StartQuestForCurrentPlayerNet(1404001480)   # Family Circle — Madame Kahina's Harbour (transport)
ts.Quests.StartQuestForCurrentPlayerNet(1404001504)   # Re-schooling — students in the Old World (select)
```

## Nomad quests (giver 1404000018 — Nomad resident)

```
ts.Quests.StartQuestForCurrentPlayerNet(1404001532)   # Oasis Idyll (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001541)   # Poor Relations — The Tithe (use item / select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001556)   # Coming of Age — Left Out (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001563)   # Coming of Age — The Lion's Den (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001572)   # Coming of Age — Lost Daughter (select)
ts.Quests.StartQuestForCurrentPlayerNet(1404001580)   # Coming of Age — Ghost at the Feast — dates + pomegranate juice (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001588)   # Bouncing Baby Brothers (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001594)   # A Cup of Kindness — 10t pomegranate juice (deliver)
ts.Quests.StartQuestForCurrentPlayerNet(1404001598)   # Fieldwork (gift)
ts.Quests.StartQuestForCurrentPlayerNet(1404001608)   # Goodbye Old Friend (photo)
ts.Quests.StartQuestForCurrentPlayerNet(1404001615)   # The Goat Escape (picture puzzle)
ts.Quests.StartQuestForCurrentPlayerNet(1404001621)   # Zootopic — Old World zoo (photo)
ts.Quests.StartQuestForCurrentPlayerNet(1404001629)   # Desert Verse — poem to Madame Kahina (transport / pickup object)
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
| 1290 Horns of Contention | 1275 Courtesy of the Guest |
| 1652 The Arranged Match | 1290 Horns of Contention + a Mosque in the area |
| 1662 Idle Hands | 1304 How the Envoy Stole Eid + Carpet Workshop, Date Plantation, Camel Farm in the area |
| 1321 Public Repentance | 1662 Idle Hands + a Mosque in the area |
| 1351 The Vote | 1330 The Speech + Town Hall in the area |
| 1358 The Smear | 1351 The Vote + Town Hall in the area + a Marketplace in the session |
| 1376 Stern Decrees | 1358 The Smear |
| 1412 Penance | 1405 Festive Splendour + 3 Nomad houses in the area |
| 1426 Tolerance | 1412 Penance + Rose Water and Marzipan unlocked |
| 1563 The Lion's Den | 1556 Left Out + an Envoy house in the area |
| 1572 Lost Daughter | 1563 The Lion's Den + a Date Plantation in the area |
| 1580 Ghost at the Feast | 1572 Lost Daughter |

The vanilla Enbesa follow-up quests these were cut from (Ukuli Bula 2/3, Moot Points 4/6, Man Up 2/3/6/8/10, ...) are no longer started.
