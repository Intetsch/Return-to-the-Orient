# Orient canal skin

The Orient builds its own canal street `1404004229` (InternalID 64) with the crossings `1404004230` (desert road, 65)
and `1404004231` (fast street, 66). They are full copies of the Enbesa canal `112842` and crossings `117786`/`127913`
in `buildings/assets_streets.xml`, restricted to `Mod3`, and use the cfgs in `data/graphics/buildings/orient/canal`.
Enbesa keeps the vanilla look.

## Use

`node build.js "<mod root>" [vanilla root, default D:/anno_data/1800]` (Node, `C:\tools\texconv.exe`, `C:\tools\rdm4-bin.exe`).
It rebuilds `maps/` and the 33 cfgs (29 canal pieces + 4 crossing pieces) with their `.ifo`/`.fc` from vanilla.
Stone parameters (block length, course height, joints, colours) are the `DEFAULTS` in `stone.js`.

## What changes

- `canal_system_diff/norm` → `canal_system_orient_diff/norm`: stone blocks in the style of the noria pool edge.
  - The Enbesa clay (Lab ≈ 48/24/34) becomes grey sandstone (≈ 57/3/16; the noria blocks measure L 54–63, b 15–19).
    The moss band at the waterline keeps its colour (blend weight from redness).
  - `uvmap.js` rasterises the 30 meshes that use the atlas: per texel rim top / wall / floor, the canal direction in uv
    and ~431 px per world unit. Islands are fitted to world coordinates, so joints follow the canal and meet at tile seams.
  - Rim: coping blocks 0.25 long. Walls: 0.1 courses, staggered by half a block, the top course lines up with the coping.
  - Joints are darkened in the diffuse, carved into the normal map (XY in R/G, measured R = 127.5 − k·dh/du,
    G = 127.5 − k·dh/dv) and get less gloss.
- `canal_system_ground_*_01_diff` → `*_orient_diff`: the red-brown dirt of the ground strip becomes Orient sand
  (colony02_beach_06); the grass stays. Alpha is untouched.
- Meshes, metal maps, props (boards, fences, pots, water plants) and the crossings' road textures stay vanilla.
- Every `_k.dds` is a box-halving of `_0`, encoded `-sepalpha -f BC7_UNORM -m 0` like vanilla.

`preview_before_after.png`: vanilla (left) and Orient (right) on the Orient sand, from a software render of the real meshes
(no normal mapping, no water).
