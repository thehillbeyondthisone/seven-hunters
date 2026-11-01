# Characters

The vendors (Joe at the fish stand, Marta at the chandlery) are avatars from the
[Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) library (MIT license,
`public/models/characters/LICENSE-Rocketbox.md`), converted offline to one GLB each
(`public/models/characters/joe.glb`, `marta.glb`): mesh (~7.5k triangles, 80-bone Bip01 skin),
1024² textures and the clips below.

    tools/characters/build.sh [workdir]      # fetch -> textures -> Blender -> public/models/characters/

- `fetch.sh`: one file from the Rocketbox repo (Git LFS media URL, raw fallback).
- `textures.sh`: the 2048² TGA maps to 1024² JPEG / PNG; the specular map becomes the roughness
  channel of an ORM texture (R 1, G roughness = 0.92 - 0.6 × specular, B metalness 0); the opacity
  map (hair, lashes) keeps its alpha.
- `convert.py` (Blender 4.2+, tested with 5.2, run in the background): imports the avatar, builds
  glTF-exportable materials (`body`, `head`, `opacity`), imports each clip FBX and retargets it by
  bone name in world space (the clips' skeleton rests with the arms down, the avatars in a T-pose,
  so local rotations can't be copied): every avatar bone copies its clip bone's world rotation
  (the pelvis also its position) and the result is baked, one NLA track per clip, exported as
  glTF animations.

Clips (the in-place `motextr_static` versions, `m_` for men and `f_` for women): `idle_neutral_01`,
`idle_breathe_01`, `idle_look_around_01`, `gestic_talk_neutral_01`, `gestic_talk_relaxed_01`,
`wave_01`, `gestic_shrug_01`.

Runtime: `engine/loaders/GLTF.js` (loadGLB) and `engine/render/Skinning.js` (SkinnedModel: clip
crossfades, GPU skinning, motion vectors, shadows); `game/Vendor.js` swaps the stand-in figure for
the character once it has loaded. `test/character-smoke.mjs <glb> <out.png> [clip]` renders one
headlessly.

## Seven Hunters boatman

The landing boat uses `boatman.glb`, a Joe adaptation with the original face,
eyes and hands, a tailored oilskin jacket with a turned collar, welt pockets and
horn buttons, knitted watch cap, wool cuffs, trousers and leather boots. This is an
authored period reconstruction. The Tidewater vendor assets are preserved.

Run these in order through live Blender MCP, from this workspace:

1. `boatman-mcp.py`: isolated scene, clean metre-scale 80-bone skeleton,
   retained anatomy, deforming wardrobe and short salt-and-pepper stubble.
   Loads `boatman-tailoring-mcp.py` to fuse the shoulders and sleeves into one
   shell, smooth the weights, cut sewn openings and author baked yarn detail.
2. `boatman-performance-mcp.py`: seated rowing, planted feet, distributed
   spinal movement and anatomically oriented finger closure. It runs
   `boatman-fit-mcp.py` to fit the lower jacket against the posed trousers and
   convert the correction back into the skin's bind space.
3. `boatman-export-mcp.py`: PBR baking, merged near/far skins, selected-scene
   GLB export, manifest, studio portrait and editable `boatman.blend`.

The GLB is approximately 5.8 MB, with 42,918 / 15,450 near/far triangles and ten
shared materials. `Boatman.js` samples the baked stroke from `ArrivalRowing.js`,
then solves the live shoulders, elbows, wrists and grips against the moving
oars. Horizon glances and blinks run on an independent clock. Geometry switches
at 20 m, returns at 17 m, and shares the same skin buffer and textures.

`node --run test:boatman` verifies the complete stroke, wave-driven grips,
motion history, pause, colour and distance geometry. `node --run shots:boatman`
renders eight views with the actual game renderer under `artifacts/boatman/game`.
Headless GPU checks do not establish physical phone/headset performance.

The second tailoring pass preserves the original screenshot and GLB under
`artifacts/boatman/refinement/` for direct comparison. Construction volumes stay
in the editable reference collection and are explicitly excluded from export.
