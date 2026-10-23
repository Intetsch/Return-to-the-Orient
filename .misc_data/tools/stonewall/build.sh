#!/usr/bin/env bash
# Rebuilds the Small (1404004850) and Large (1404004851) Oriental Wall and the Oriental Wall Junction (1404004852):
# textures, piece meshes, cfg/ifo, the grass-free ground decals and the build-menu icons.
# Run from Git Bash. Work files land next to this script (git-ignored).
set -e
cd "$(dirname "$0")"
MOD="$(cd ../../.. && pwd -W)"
rdm() { /c/tools/rdm4-bin.exe -i "$(cygpath -w "$1")" -o "$(cygpath -w "${1%.gltf}.rdm")" -g P4h_N4b_G4b_B4b_T2h --no_transform --force > /dev/null 2>&1; }
node build_tex.js tex
node ground.js ground
for v in small large; do
  m=mesh; [ $v = large ] && m=mesh_large
  node build_wall.js tex $m $v
  for g in $m/*/*.gltf; do rdm "$g"; done
  node fixtbn.js $m/*/*_lod0.rdm
  node install.js tex $m ground $v
done
node build_junction.js tex mesh_junction
for g in mesh_junction/*/*.gltf; do rdm "$g"; done
node fixtbn.js mesh_junction/*/*_lod0.rdm
node install_junction.js mesh_junction
# icons: the asset icons through the ornament icon tool, the other junction variations here the same way
# (junction icons from 60 deg like OPTS in render_all.js, so the tall wall does not hide the low arms)
(cd ../ornament_icons && node render_all.js --only stonewall,stonewall_large,stonewall_junction_cross --install > /dev/null)
mkdir -p icons
for j in t_large t_small corner_a corner_b; do
  node ../ornament_icons/icon.js "$MOD" data/graphics/buildings/orient/stonewall_junction/stonewall_junction_$j.cfg icons/stonewall_junction_$j.png '{"look":{"el":60}}' > /dev/null
  (cd icons && /c/tools/annotex.exe -f=diff -l=4 stonewall_junction_$j.png > /dev/null)
  cp icons/stonewall_junction_$j.png icons/stonewall_junction_${j}_[0-3].dds ../../../data/graphics/icons/ornaments/
done
node layout.js preview.png 900 '{"fitWalls":true}' "0,0 1,0 2,0 3,0 1,-1 2,-1 3,1" > /dev/null
node layout.js preview_large.png 900 '{"fitWalls":true,"variant":"large"}' "0,0 1,0 2,0 3,0 1,-1 2,-1 3,1" > /dev/null
node layout.js preview_junction.png 900 '{"cull":true,"fitWalls":true,"large":"2,-2 2,-1 2,1 2,2","junctions":{"2,0":"cross@90"}}' "0,0 1,0 3,0 4,0 2,-2 2,-1 2,1 2,2" > /dev/null
echo "done - previews: preview.png, preview_large.png, preview_junction.png"
