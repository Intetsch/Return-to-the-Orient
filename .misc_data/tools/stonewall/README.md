# Small Oriental Wall

A low, draggable stone wall ornament, `orientStoneWall` **1404004850** (`buildings/ornaments/assets_stonewall.xml`),
built from the L-shaped wall in front of the Incense Workshop tower. That wall is part of
`sbm/iaam/orient/004handwerk/schmied/rdm/n_toolmakers_workshop_lod0.rdm` (triangles 48–59, the back-left corner)
and uses the light ashlar strip of `s_toolmakers_workshop_diff`. The new wall has the same size: 0.24 high,
0.1 thick, free ends chamfered 0.07 at the top.

**Large Oriental Wall** `orientStoneWallLarge` **1404004851** (user, 2026-10-21) is the same system 3× as tall:
- 0.72 high, with the same thickness, free-end set-back (0.07), caps, blockers and ground.
- The second ModOp in `assets_stonewall.xml`. Graphics in `data/graphics/buildings/orient/stonewall_large`.
- Listed after the small wall in the same menus and triggers.
- Connected to the small wall (user, 2026-10-21): each lists the other in `InfluencedByNeighbors`, so a large run steps
  down to a small one.
  - At the joint both arms reach the tile edge. The large wall's end cap is the visible step face; the small wall's cap
    lies inside the large wall.
  - Preview mixed runs with `layout.js` `"large":"x,z x,z"`.
- `variants.js` holds both sizes. `build_wall.js`, `install.js` and `layout.js` (`"variant":"large"`) take `small` or `large`.

**Oriental Wall Junction** `orientStoneWallJunction` **1404004852** (user, 2026-10-21) is for tiles where a large and a small
wall cross, branch or turn. The neighbour system only sees *whether* a wall is next to a tile, not which size, so no
wall tile can pick "large through, small branch" by itself.
- Like vanilla CDLC09 gates and towers, the junction is a plain ornament: no neighbour tables, so the player turns it.
  It has 5 variations, picked in build mode with VariationIcons like the CDLC11 benches.
  - `cross`: large ±x, small ±z.
  - `t_large`: large through, small branch −z.
  - `t_small`: small through, large branch −z, ending in a face above the small wall.
  - `corner_a`: large +x, small −z.
  - `corner_b`: small +x, large −z. Turning one corner never gives the other.
- Both walls list it in `InfluencedByNeighbors`, so their arms run flush into it.
- Third ModOp in `assets_stonewall.xml`. Graphics in `data/graphics/buildings/orient/stonewall_junction`: each cfg has two
  MODELs, the large part with the large wall's material and the small part with the small wall's.
- Ground decal, walker blockers and hit boxes are those of the matching wall piece (`SHAPE` in build_junction.js).
- `build_junction.js` builds them from the same `kit(H, layout)` as the walls, so the UVs line up with neighbouring tiles.
  Where a small wall passes a large one, its faces are split so no faces overlap.
- `install_junction.js` installs them with install.js's cfg/ifo writers.
- Icons are rendered from 60° (`look` in ornament_icons/icon.js, OPTS in render_all.js). At the vanilla 38.5° the tall wall hid
  the low arms, and the crossing looked like the T.
- `layout.js` places junction tiles with `"junctions":{"x,z":"cross@90"}` (+90° turns +x to −z).

## Use

`bash build.sh` (Git Bash, Node, `C:\tools\rdm4-bin.exe`, `texconv.exe`, `annotex.exe`, the extracted vanilla tree on `D:\anno_data\1800`).
It rebuilds `data/graphics/buildings/orient/stonewall` (maps, rdm, cfg, ifo) and `data/graphics/icons/ornaments/stonewall*`,
and writes `preview.png`, a software render of a small layout.
`node layout.js <out.png> <size> '{"az":45,"sunAz":105}' "x,z x,z …"` renders any set of tiles with the piece and rotation
the neighbour system would pick.
- `"step":0.05` raises every other tile, like uneven terrain.
- `"cull":true` drops back faces like the game; the renderer otherwise draws both sides, so it hides holes.
- `"root":"<dir>"` loads the cfgs from another mod root, for before/after comparisons.

## How it works

- `src.js` samples the source maps through the source mesh's own UVs: the outer face around the L (`outer(s, y)`,
  1.40 long, u runs along n × up) and the cap stones of both arms (`topX`, `topZ`).
- `build_tex.js` makes one 128×64 atlas per map (diff, norm, metal; the source's are 1024×512 at the same texel density):
  - rows 2–37: the face band, one tile (1 unit = 128 px) long. It is made periodic with a vertical min-error seam in a 28 px overlap,
    so the band continues across every tile edge.
  - rows 42–51: the cap band, cut from joint to joint out of both arms (joints from the column brightness) and resampled
    115 → 128 px, so the tile edge lies on a joint. The z arm is mirrored relative to the x arm, so its rows are reversed and
    its normal x/y negated.
  - The other rows are edge padding against bilinear and mip bleeding.
  - Large wall atlas (128×128): the face 3× as tall (108 rows), stacked from five copies of the face band shifted in x by 0/43/85/21/64.
    - The bottom copy keeps the ground rows (band 0–29), the top copy the light top edge (6–35), the middle ones only inner courses (4–31).
    - Each joins the one below along a minimum-error cut through a 9-row overlap that wraps in x.
    - Stretching the band would have made the stones 3× taller; plain stacking would have repeated the dark footing and the light edge.
- `build_wall.js` builds the pieces at rotation 0 with vanilla 102093's arm directions:
  mid −x/+x, end −x (free end toward +x), corner +x/−z, x all four, t −x/+x/−z, single none.
  - Side faces: u = (position · (n × up)) + 0.5, so it is 0 or 1 at every tile edge and any mix of rotated tiles continues the band.
    The corner uses the path length instead (outer 1.1, inner 0.9), so the band wraps around it like on the source L.
  - Tops: the band along the arm, mitred at the corner. Chamfered end faces show a 0.1 slice of the face band.
  - Every arm is closed with an end cap at the tile edge. The game fits each tile to the terrain on its own, so
    neighbours can sit at slightly different heights. Without caps the step showed the hollow wall: the user saw a hole
    at the joints on 2026-10-21. Lined up, both caps lie inside the wall and stay hidden.
  - The no-neighbour case (`DontCare`) uses the extra `single` piece, variation 5, like vanilla residences use DontCare pools.
- rdm4-bin writes T = −dP/du like vanilla, but B = +dP/dv. `fixtbn.js` negates B (vanilla and the source wall store
  B = −dP/dv) and sets the vanilla z-sign flag bytes; it prints a per-triangle check that must be all "ok".
- DDS files are encoded into `tmp_dds/` and copied only when they changed. Previewers and scanners keep freshly written DDS
  mapped for a while, and Windows then refuses to overwrite them ("user-mapped section open"), even with identical bytes.
- `install.js` writes the maps (`_0.._2.dds` box halvings, BC7 `-sepalpha`, full mips, like the source maps), the rdm files
  (`*_lod0.rdm` names, so the missing LODs are tolerated) and the cfg/ifo: the source's material (cDiffuseColor 0.75),
  tile-sized bounds, one hit box per arm.
- Ground (user, 2026-10-21): the Orient canal's bank decals with the **grass removed for the wall only**. The canal
  keeps its grass (user rule).
  - `ground.js` writes `maps/stonewall_ground_<shape>_diff_0.png`, and install.js adds `_0.._4.dds` like the canal maps.
  - Source: `canal/maps/canal_system_ground_*_01_orient_diff`. The six shapes share one colour image.
  - Mask: Lab a* < 2.5 in any shape, grown 2 px, plus the pebble islands it encloses.
  - Fill: image quilting from opaque sand (20 px blocks, minimum-error cuts, random among the 6 best), applied to all six with their own alpha.
  - A PatchMatch fill with voting came out as a flat blob, and so did best-patch copying after averaged initialisation.
  - Normal map: vanilla's shared straight map, flat under the old grass. Material as on the canal.
  - Piece → decal: mid → straight, end → end, corner → curve, t → 3way, x → cross, single → single.
  - Their opaque edges (u along +x, v along −z): straight ±x, end +x, curve +x/−z, 3way ±x/−z, cross all four, single none.
    So only the end decal is turned 180°. Measure the edge alpha rather than judging from a picture.
  - The band runs unbroken along every wall, closes at free ends and leaves a loop's inside free. FeedbackBlockers follow the vanilla wall
  systems (park fence 102093, CDLC09 walls): everything except a half-tile corridor along the arms, closed at free ends,
  so walkers can't cross. orientFence01's ifos got the same layout (2026-10-20).
- The icon is the straight piece (variation 0), like the fence's.

The asset is a copy of orientFence01 1404004205 (same neighbour tables, cost, description 17728) with the extra variation.
It sits after the fence in both Orient ornament menus and in the 2.1 / 2.2 / creative unlock triggers.
