# Rammed Earth Farm

Rammed Earth `1404009000` replaces the Enbesa mud bricks `114402` in the Orient. The Rammed Earth Farm `1404009002`
(clay → rammed earth, 30 s) uses oxidation pool fields `1404009003`, chain `1404009004`, unlock pool `1404001299`
(formerly the mud bricks pool).

Scripts (run from a working folder; they expect their inputs next to themselves):

- `dome.js <maps dir>`: needs `gltf.gltf` (`rdm4-bin -i s_silk_plantation_lod0.rdm -o gltf -e gltf`) and
  `s_silk_plantation_diff_0.png` (texconv). The silk plantation dome gores (faces above y 0.95, atlas box x < 480, 160 < y < 365)
  are recoloured in Lab: teal → clay brown (L 44, a 17, b 27), gold trim → sandstone (L 70, a 6, b 26), dark lines kept.
  It writes `rammed_earth_farm_diff_0..2.dds` (BC7, box halvings, like the original's three levels) and the `_0.png` source.
- `probe.js [diff png] [out png] [w h scale]`: software render preview + uv height map.
- `icon.js <out png>`: keys the baked checkerboard out of the placeholder art (`src.png`), crops and area-scales to 128 px.
  Then `annotex -f=diff -l=4` in the icon folder.
- `costcheck.js <patched assets.xml> [product]`: Mod3 assets whose resolved cost (through BaseAssetGUID) still uses a product.

`rammed_earth_preview.png`: silk plantation (left), rammed earth farm (right), icon.
