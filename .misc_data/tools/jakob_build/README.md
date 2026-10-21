# Building Jakob's shared submods

Jakob's shared mods on GitHub (jakobharder/anno1800-shared-mods) are **sources**: `.gltf/.bin`, `.cf7`,
`.cfg.yaml` and `*_diff/_norm/_rga/_height.png`. The game needs the built files (`rdm/*_lodN.rdm`, `.fc`,
`.cfg/.ifo`, `maps/*_0.._2.dds`). A submod copied straight from the source repo shows props but no main
mesh and grass instead of its yard (OW Tools workshop, 2026-10-21).

`build.js` runs the anno-modding-tools VS Code extension's own `ModBuilder` headless (stubbed `vscode`),
so the output matches Jakob's releases. The extension (2.3.1) is in
`C:\Users\maxim\Downloads\vs code backup\extensions\jakobharder.anno-modding-tools-2.3.1`.

```
# 1. copy the submod to a scratch folder and drop "bundle" from its modinfo.json
# 2. build into a scratch out folder (annoRda = extracted vanilla tree)
node build.js "<extDir>" "<scratch>/src/<submod>/modinfo.json" "<scratch>/out/<submod>" "D:/anno_data/1800"
# 3. copy only the new files back (cp -rn out/<submod>/data <repo>/<submod>/)
```

The build ends with `BUILD THREW TypeError: f is not a function` from the test step; everything before
it is already written.

Checks:
- `refcheck.js <modRoot> <submod>...` lists file references found nowhere (mod, submods, D: tree).
- `meshcheck.js <srcDir> <rdmDir> <tmpDir> <gltfName>...` compares rdm vs gltf index/primitive counts.
- `mipcheck.js <tmpDir> <file.dds>...` prints the mean RGBA per mip (normals should stay ~125,125).
- `.fc`: `AnnoFCConverter -r x.fc -o x.cf7` and compare with the source `.cf7`.
