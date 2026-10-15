# Vendor stall assets

Builds `public/models/props/` (Joe's fish stand and Marta's chandlery, see `src/game/StallKit.js`)
from Poly Haven CC0 downloads.

```sh
python3 tools/props/fetch.py                                             # downloads into tools/props/.raw (git-ignored)
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/props/decimate.py   # decimated copies in .raw/dec
node tools/props/build.mjs                                               # needs ImageMagick (magick)
```

`build.mjs` packs every model into `props.bin` / `props.json` (position, normal, uv and texture layer per
vertex), writes 512 px prop textures and 1K surface textures, and draws `signs.png` (signs, chalk prices,
the scale dial) with the fonts in `fonts/` (Apache 2.0 / SIL OFL 1.1, licence texts included).
To add a prop: add its Poly Haven id to `MOD` in fetch.py, `MODELS` in build.mjs and `BUDGET` in
decimate.py, rebuild, then place it with `KitBuilder.prop( name, matrix )`.

## Authored station joinery

`station-joinery-mcp.py` is a separate Blender MCP authoring/export path for the
working kitchen/berth doors, reusable door and gate hardware, and entrance steps.
Execute its text through the live Blender MCP, with the user's approved request
as `user_prompt`. It creates a new isolated scene and preserves the original
scene; it does not clear Blender or save over the user's open file.

The script writes `station-joinery.blend`, `StationCraftModel.js` and the export
summary under `artifacts/prop-quality/blender/`. `StationCraft.js` stamps those
indexed parts into existing engine material batches. Door hinges remain at local
zero, leaves extend along +X, Y is up and all dimensions are metres. Moving door
parameters and collision geometry remain in `Station.js` and `NextRooms.js`.
These construction details are period-plausible reconstructions, not recovered
Flannan hardware. No external asset service or generated texture is required.

The authoring script uses this checkout's absolute workspace path in `ROOT`;
adjust that path when moving the project. The browser reviewer is
`/test/prop-quality.html?setting=flannan&noAudio`; it has day/lantern views and
opens the actual doors without writing watch saves. Run
`node tools/shots/prop-quality-audit.mjs` against the retained local originals
to verify export health, unchanged collisions/door parameters and mesh cost.

## Authored room furnishings

`room-craft-mcp.py` builds 22 named furniture and object prototypes through live
Blender MCP and writes `room-craft.blend` plus `RoomCraftModel.js`. The separate
scene preserves other open scenes and never saves over the user's main file.
`RoomCraft.js` caches the indexed parts and assigns the existing station timber,
metal, cloth and crockery finishes. Clear lamp chimneys and wick flames use two
merged transparent batches, assembled in `Station.js`.

The same browser reviewer now includes room, desk, table, dresser, stove and
oilskin views. `node tools/shots/room-craft-audit.mjs` compares exact collision,
interaction and lamp coordinates with the retained originals and checks every
exported mesh. Review images and the geometry report live in
`artifacts/room-craft/`. These are reconstruction studies; their detail must not
be presented as an inventory recovered from the original station.

## Hero storm lantern

`hero-lantern-mcp.py` reuses the room study's mesh helpers and authors the actual
pickup/carried storm lantern in a new Blender scene. It writes
`hero-lantern.blend` and `src/station/HandLampModel.js`. The foot is Y=0, the grip
is Y=.32 and the flame source is Y=.13, matching `HandLamp.js`. Six finish groups
merge the small modeled parts into six draws. Clear glass and a separate flame
replace the opaque globe; lighting and carrying behavior stay in `HandLamp.js`.

`node tools/shots/hero-lantern-audit.mjs` compares handling, flame position and
save/load with the retained original and validates export health. The browser
reviewer's Hero lantern close view and reverse view keep it on the table in both
day and lit-night modes. Captures are in `artifacts/hero-lantern/`.

`hero-lantern-materials-mcp.py` creates a separate editable material study without
changing the original scene or geometry. It saves `hero-lantern-materials.blend`.
The runtime material fields and bounded flame response live in
`src/station/HandLampMaterials.js`; they use the lantern's local metre coordinates
so wear follows it when carried. `node tools/shots/lantern-material-compile.mjs`
compiles all six finishes and an unrelated material control through the actual
WebGPU shader composer. Material review images are in `artifacts/lantern-materials/`.
