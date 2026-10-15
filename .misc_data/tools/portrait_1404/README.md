# Anno 1404 portraits

Converts the Anno 1404 character portraits (`D:\anno_data\1404\data\graphics\units\portraits`, animations in
`...\anims\portraits`) into player portraits, the same way the Nomad and Envoy (`portraits/orient/resident_orient_tier01/02`)
were made. The busts are not extended downward (no `portrait_body` step).

34 portraits:
- 32 of the 35 base-game 1404 portrait cfgs, all except the Nomad and Envoy (already in the mod) and `player`.
  That one is the peasant mesh with `player_0.dds`, a 2008 placeholder that is black in every block.
- The addon's (Venice) two in `D:\anno_data\1404\addondata\graphics\units\portraits`: Giacomo Garibaldi and the Spy.
  - They come after the base game in the manifest, so the first 32 keep their GUIDs.
  - They use a newer rig: top bone `SkinBone_RibCage`, then neck, head, and eyes `SkinBone_Eye_Lf/Rt`.
    The chain treats it like the old one; the importer deletes the top bone.
  - The Spy's 1404 cfg plays his talk animations in the idle sequences too, though his own `*_idle` files ship beside them.
    `manifest.js` uses those for the idle moods.

Output:
- `data/graphics/portraits/1404/<id>/`: cfg, ifo, `rdm/<id>.rdm`, `anim/<id>_<mood>_<idle|talk>.rdm`, `maps/<id>_diff_0.._2.dds`;
- picker tiles `data/ui/2kimages/main/profiles/portrait_1404_<id>.png` + `_0.._3.dds`;
- texture sources in `.misc_data/data/graphics/Portraits/1404/<id>/`;
- `assets_includes/portraits/assets_1404_portraits.xml`: Portrait assets 1404004600–633 (`portrait_1404_<id>`, manifest order),
  plus their entries in the CreateGameScene (500769) picker list.
  The picker list is grouped by hand (AI difficulty, region, role). `assemble.js` therefore never rewrites an existing file.
  It only adds missing assets at the end of the asset ModOp and missing picker entries at the end of the list. Move those afterwards.

## The chain

It is the chain of `originals/import_*_from_cn6_na2.bat`, scripted:

1. **Nexus Buddy 2** (`C:\Users\maxim\source\repos\Nexus-Buddy-2`, Granny runtime): mesh `.gr2` → `.cn6`, each animation `.gr2` → `.na2`
   (world matrices sampled at 60 fps). `nbdriver/NbDriver.cs` drives the GUI's own code headlessly:
   - the CN6 writer is a port of `CN6FileOps.WriteModelToCN6`, byte-identical to the GUI export of the Nomad and Envoy;
   - the NA2 export calls `NB2Exporter.exportNA2` with the GUI defaults (full range, 60 fps; the animations are 120 fps).
   - The form constructor throws in `Available.Startup` because `HKCU\Software\Firaxis\Tools\ToolAssetPath\Assets`
     (`D:\anno_data\1404\Assets`) does not exist. The driver catches that and adds the Granny context itself.
   - It needs x86 and `useLegacyV2RuntimeActivationPolicy` (`NbDriver.exe.config` = `NexusBuddy2.exe.config`).
   - Nexus Buddy leaves `temp[anim]open<digits>.gr2` copies in `%TEMP%`; `convert.js` deletes the ones each run made.
2. **Blender 3.5** (`cn6_na2_to_glb.py`, the options of `originals/portrait_importer.py`): `.cn6` + one `.na2` → `.glb`.
   The add-ons `io_import_cn6` / `io_import_na2` come from the user's Blender 3.5 profile.
3. **rdm4-bin** (`C:\tools\rdm4-bin.exe`, `-sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform`): `.glb` → mesh `.rdm` + `_anim_0.rdm`.
   The mesh comes from the angry-idle glb, as in the bat files.

Rerunning the chain on the Envoy reproduces the shipped `resident_orient_tier02.rdm` and `_angry_idle.rdm` byte for byte.
On the user's hand-edited `s_nomad.cn6` it reproduces the shipped Nomad files.

What the chain does by design, and the Envoy and Nomad already show it:
- `io_import_cn6` deletes the top bone (`DELETE_TOP_BONE`). Root-only vertices land on glTF's `neutral_bone` and stay still.
  Vertices shared between root and head follow the head fully.
- `io_import_na2` never keys the first bone, so the ~30° turn the 1404 animations give the root is not carried over.
  The head bones get world matrices, so the head keeps that turn relative to the still bottom edge.

## Checks and repairs (`convert.js`)

Every animation is round-tripped through rdm4 back to glTF and compared with the Granny ground truth
(`animcheck.js`: `v · IWT · World(t)` from the .cn6 and the raw .na2, with the pipeline's root handling).
The Envoy matches within 0.06 mesh units. `node summary.js` prints one line per portrait.

- **Scaled and mirrored bones.** `io_import_cn6` builds the rest pose from the .cn6 local position + quaternion only,
  and `io_import_na2` keys only location + rotation. Some bones have scale in their Granny bind: Sir Gavin's head 1.29,
  most eyelids 1.5. Others are mirrored (negative determinant): right-side earrings, beards, mustaches, ruffs and wimples,
  and the Nomad's `Bone_cloth_Left`. These came out wrong, by 5–10 units for scale and 20–150 for mirrors.
  That is why the Nomad was hand-edited (its cloth weights were removed).
  `na2rigid.js` rewrites every bone's matrix as `RestRigid · IWT · World(t)`. This is Granny's own skin transform, which is rigid,
  placed on the importer's rest pose, so the importer keys it exactly. Bones without scale are left unchanged.
  With it every bone matches Granny within ~2.4 units (most within 0.01), and the mirrored accessories animate.
  `bindinfo.js <cn6>` lists the scaled and mirrored bones.
- Fallback, not needed by any portrait: a bone still off by more than 5 units would lose its skin weights like the Nomad's
  (`cn6fix.js`: renormalized to 255; a vertex left empty goes to the nearest healthy ancestor). The portrait would then be converted again.
- **Several sub-meshes.** rdm4 converts only the first mesh of a glTF. `cn6merge.js` merges the sub-meshes into one first
  (Lord Northburg: `Object01` + the body; both use the one 1404 texture). Sub-meshes without a material are stray helpers and are
  left out (his 32-vertex `Bone_Head` box).
- **Sick Emperor.** Granny faults (access violation in `SampleAnimation`) on any animation sampled on his model.
  His mesh is a 64-bit Granny file, but that is not the cause: the addon's two 64-bit meshes sample fine.
  Resaving it or rebuilding it through Nexus Buddy's BR2 import does not help, and neither does
  evaluating the curves directly (`IGrannyCurve.Sample`). So his own three 1404 animations cannot be converted.
  He gets the healthy Emperor's six animations instead (the user's choice; `manifest.js` RETARGET). `na2retarget.js` maps them
  onto his skeleton bone by bone (root, head, eyes, eyelids) as motion relative to the parent, applied about his own pivots,
  so the eyes stay in his sockets. His three medals keep their bind pose. Retargeting the Emperor onto himself reproduces his .na2 exactly.
  `faceclose.js <mod> <id> <slot> out.png k...` renders face close-ups for checking.
- rdm4 writes `buffer0..n.bin` next to every glTF it exports, so each round trip gets its own folder.
- The .cn6/.na2 are read and written as latin1 bytes; bone names are UTF-8 (the corsair's `strähne_links`).

## Placement, textures, tiles

- cfg/ifo: the Envoy's bust-only versions from commit fbff52a9 (`template.cfg`, `template.ifo`), with the same 9 animation slots and
  sequences. `ORIENTATION_TRANSFORM` x/y put the mean eye position of the neutral idle at world (0, 3.10),
  where the shipped Nomad (−0.02, 3.13) and Envoy (0.00, 3.07) have theirs (`eyes.js`).
- Textures: 1404 DXT5 `.dds` → PNG (texconv) → `annotex -f=diff -l=3`, as the Envoy's (`textures.js`).
  The alpha channel stays: it holds the 1404 hair, feather and flower cut-outs. The game's model shader (ShaderID 8, no alpha blend)
  cuts them out, as it does for vanilla `resident_tier04` and `ai_04`, which have 10–15 % of their surface on transparent texels.
- Picker tiles: `icons.js` renders bust + lower body with `portrait_body/icon.js` (yaw −14°, 256 px, `alphaTest` on).
  Like the Nomad's and Envoy's tiles, each is framed 162 units from the top of the head (more for tall headwear).
  Without a body it would stop where the bust still covers the middle of the tile.
  `INSTALL=1` copies the tiles into the mod and runs `annotex -f=diff -l=4`.
  - Two busts are modelled turned, shoulders included: Lord Northburg about −34°, the Sick Emperor about +28° (eye line).
    Their tiles (`FACE_ALIGN`) turn the camera so they look where the others do, shift it so the eyes land at the usual spot,
    and pose the eyes at their mean neutral-idle rotation (`tilepose.js`). The Lord's bind pose has his eyeballs turned aside.
  - The Sick Emperor's yaw comes from his eye line (−41.7°). The Lord's is set by eye to 40°: with his head tilt
    he still looked right at the measured 20.5°.
  - Only the tiles changed; the 3D portraits in game keep their original turn.
- `animsheet.js <mod> out.png [id ...]`: QA sheet, every portrait at rest and posed in three animations from the rdm round trips.

## Lower bodies

Each portrait has a second, static MODEL in its cfg: `rdm/<id>_body.rdm` (P4h_N4b_G4b_B4b_T2h, no skin) with
`maps/<id>_body_diff` (1024×512), as the Nomad and Envoy got from `../portrait_body` (2026-10-04).
- **Mesh** (`body1404.js`, driven by `bodies.js`): the bust's bottom edge extruded straight down to the hips, in 30 rows,
  checkerboard triangles, a tuck row behind the seam and a fan underneath.
  - It is portrait_body's method, generalised. The bust is first moved so its lower third is centred, and turned by its eye line
    when that deviates more than 15° (Lord Northburg, the Sick Emperor, the Cardinal).
  - Hips: eye height + 238 units, where the Nomad's (239.8) and Envoy's (235.9) bodies end.
  - The rim is found on still triangles only. Every vertex's motion over all six animations is measured, and triangles that move
    as a whole are left out (the Witch's hair strands reach the rim and swing with the head). Every rim found is static (0.00 units).
  - Willem van der Mark's bust is closed by a flat cap; his rim is the cap's outer perimeter.
- **Texture** (`bake1404.js`): the garment just above the rim, sampled every 0.4 units of arc, carried straight down.
  - The colour runs from the local profile into a wide, tone-weighted average, so trims, fur edges and chains fade out within
    ~60 units instead of running as stripes.
  - The profile's folds sway and fade, new folds grow in further down, and the hips get slightly darker.
  - A plain dark belt with a brass buckle sits at the Nomad's/Envoy's sash and belt height (eyes +190…+204).
  - The seam blends into the bust's own rim colour.
- `bodyfiles.js`: rdm (the extension's rdm4, as in build.sh) and the annotex `_0.._2` chain.
- `assemble.js` copies them, adds the body MODEL (the bust MODEL minus its animations, the portrait_body/patchcfg.js way), and grows
  the cfg/ifo bounds down to the hips.
- `bodyprev.js out.png cell id...`: preview of bust + body.

## Use

```
node manifest.js                      # 1404 cfgs -> manifest.json (mesh, texture, the six animations by 1404 sequence ID)
node convert.js [--reuse] [id ...]    # needs work/nbdriver/NbDriver.exe (see below); ~20 min for all, report in work/report_*.json
node textures.js
node icons.js "<mod folder>"          # once first: exports each shipped bust (work/<id>/icon/out.gltf) the bodies are built on
node bodies.js && for id in ...; do node bake1404.js $id; done && node bodyfiles.js
node assemble.js "<mod folder>"       # copies into the mod, writes cfg/ifo, adds missing assets to assets_1404_portraits.xml
INSTALL=1 node icons.js "<mod folder>"
```

To build the driver, copy `NexusBuddy\bin\Release\*` of the Nexus Buddy repo and `nbdriver/NbDriver.cs` into `work/nbdriver/`, then run
`C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe /platform:x86 /out:NbDriver.exe /r:NexusBuddy2.exe /r:Firaxis.Framework.dll /r:Firaxis.Framework.Granny.dll /r:System.Windows.Forms.dll NbDriver.cs`.
Finally copy `NexusBuddy2.exe.config` to `NbDriver.exe.config`.

`work/` is git-ignored.
