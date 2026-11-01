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

## Keeper craft expansion

Run `keeper-craft-mcp.py`, then `keeper-craft-export-mcp.py` through live Blender
MCP with the user's request as `user_prompt`. The export runs
`keeper-hands-rig-mcp.py` too. They create a separate scene and save
`keeper-craft.blend`; earlier scenes and the user's open main file are retained.
The 31 editable prototypes cover the Brownie body and separate key/shutter,
service containers and tools, seated boatman and arm/hand segments, canvas bags,
folded and hanging cloth, blankets, laid rope, a knot, carriage rollers, frame
clamps, crank and driving weight. These are authored reconstructions without
invented maker marks or claims of an original Flannan inventory.

`KeeperCraftModel.js` exports evaluated, indexed meshes in metres, Y up. Near
prototypes total 59,500 triangles; distance versions total 24,030. These are
library totals, not the triangles drawn in a frame. The browser receives the
model through the existing hashed binary asset path (about 1.12 MB gzip).
Static details merge into existing station/boat batches. The rigid boatman here
is retained as a construction study; the arrival now uses the fully skinned
Joe adaptation documented in `tools/characters/README.md`. Each first-person
hand pose merges into one draw. The Blender study includes an editable rowing
rig and open/grip/pinch finger poses.

A pinned cloth panel is simulated for 24 frames and exported as frozen geometry.
Cycles bakes a 128-square detail tile: RG tangent normal, B roughness, A ambient
occlusion. The actor and hand material samples the tile; static furnishings retain
their existing game finishes. The simulation and Blender shaders do not run in
the browser.

`KeeperHands.js` follows the lantern bail, moving crank, service tools and held
camera. The camera key turns during film winding and its shutter tab depresses
during exposure. Hands and held equipment are excluded from the captured
photographs, reading, free camera and XR. Taking the Brownie removes its desk
copy. No new saved state or interaction requirement is introduced.

Run `npm run test:keeper-craft` for export, packed delivery, pose, grip, distance
and adjoining interaction checks. `npm run shots:keeper-craft` writes fourteen
actual WebGPU views and GPU validation results under `artifacts/keeper-craft/game/`.
Run `npm test` for the connected watch/story checks. Phone/headset performance
and physical controller feel are not established by these checks.

## Unpacking belongings

`unpacking-craft-mcp.py` runs only through the live Blender MCP. It creates a
separate editable scene, retains the user's open scenes and main file, and writes
`unpacking-craft.blend` plus `src/world/flannan/UnpackingCraftModel.js`.
`UnpackingCraft.js` stamps these meshes into the room's existing opaque batch;
the browser receives the data through the hashed packed-model binary path.

The six prototypes cover the closed and opened canvas holdall, its broad leather
belts, open brass buckle frames and stitched carrying handles, the folded shirt
and blue wool stockings, tied paper parcel, opened wrapper and Mary's folded
note. The original detailed 1900 Brownie prototype remains in `KeeperCraft.js`.
The closed bag rests at local Y=.008, with handles reaching Y=.416; the opened
bag's flaps reach Z=+/-.258. It uses the same floor anchor as the previous bag.
These are authored personal belongings, without invented maker marks or claims
of an original Flannan inventory.

Run `node test/unpacking-craft.mjs` to check finite indexed meshes, unit normals,
placement bounds, batch reuse and binary round trips. The six prototypes total
29,854 triangles and 384,820 gzip-compressed binary bytes; only the visible state
is drawn. `node tools/shots/unpacking-craft.mjs` captures five views using the
game's own WebGPU renderer under `artifacts/unpacking-craft/game/`.

## Camera and lantern hand contacts

`keeper-hand-poses-mcp.py` must run through live Blender MCP. It retains all
open scenes and the main file, creates an isolated contact study, and exports
`keeper-hand-poses.blend` plus `KeeperHandPosesModel.js`. The five complete poses
cover both Brownie grips, its shutter finger, the winding-key pinch, and a grip
around the storm lantern's bail. Each has an editable wrist and fourteen finger
or thumb joints; each evaluated pose contains 3,744 triangles. Existing craft
and equipment models remain intact as the study's contact references.

The same MCP export owns the item attachment and table-support coordinates.
`KeeperHands.js` consumes those values and supplies the physical Brownie lens
viewpoint for the supported first exposure. Generic service poses remain
available for existing chores and the domestic/storm contact hooks.

Run `node test/keeper-hand-contacts.mjs` and `node test/keeper-craft.mjs` for
export, grip-state, physical lens alignment and visibility checks. Run
`node tools/shots/keeper-hands-review.mjs final` for actual WebGPU exposure,
winding, table support, pickup and carry captures under
`artifacts/keeper-hands-review/final/`. The earlier before/after captures and
MCP export responses remain beside them. These checks do not establish
physical phone or headset performance.

The mandatory winding handle uses a sixth pose from
`keeper-crank-grip-mcp.py`, saved separately as `keeper-crank-grip.blend`.
For a complete rebuild, run the camera/lantern hand script first, then this
crank script, both through live Blender MCP. The crank export appends its pose
and measured attachment without changing the five equipment poses. Its timber
handle spins freely: the hand follows the full crank orbit without a full wrist
roll. `keeper-hand-contacts.mjs` verifies the complete revolution, and the warm
review helper captures start, quarter-turn and half-turn states. The shared
renderer hook is `tools/shots/keeper-hands-warm.mjs:captureKeeperHands`.
