# Recipe book art

Procedural pen-and-ink renderer for the coffee house recipe drawings and icons.

- Drawings are 420x400 like vanilla: one ink colour (58,36,29), the shape is carried by alpha.
- Icons are 128x128, painted in the style of the vanilla recipe icons.
- Every scene has a fixed seed, so a render is reproducible byte for byte.

## Use

1. Start `server.js` (port 8765). In the Claude desktop app this is the `recipe-art` preview in `.claude/launch.json`.
2. Drawings: open `http://localhost:8765/art.html?r=1#plain,milk`. Scene names are the keys in `compositions.js`.
   Change `r` to force a reload, because changing only the hash does not reload the page.
   Run `await saveAll('f_')` in the console. The files land in `out/` (git-ignored).
3. Icons: open `icons.html` and run `await saveIcons('i_')`.
4. Copy the PNG into the mod and build the LOD chain next to it:
   `C:\tools\annotex.exe -f=diff -l=4 <name>.png` writes `<name>_0.dds` to `<name>_3.dds`.

## Ingredient circles

`RecipeIngredientUIData` has one Item per FactoryInput, in input order. Measured in game:
- The drawing is shown at 0.867 of its pixel size.
- A circle's ring centre sits at the image's top-left + (PosX − 13, PosY + 40), in on-screen units.
- The arrow sprite is drawn 1:1 around that centre. A SouthEast arrow tip lands 52/62 further on.

`node ui_preview.js out/p.png out/f_milk.png "0,197,SouthEast;17,35,SouthEast"` mocks up a page with the vanilla arrow sprites.
First convert `data/ui/2kimages/main/assets/recipebook/circle_pointer/recipebook_arrow_*_0.dds` to PNG in `out/arrows/` with texconv.
Some directions have 2–3 sprite variants. The preview draws the second one faded, because only SouthEast (#8) and West are confirmed in game.

`ink.js` holds the stroke, hatching and vessel engine. `scenes.js` holds the objects (cezve, dallah, cups, dates, rose and so on).
`node sheet.js out.png 1 233,220,192 a.png b.png` builds a contact sheet on a parchment colour.
