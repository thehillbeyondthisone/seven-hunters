# Keeper’s Playground

Run `start-playground.bat`, or open **http://127.0.0.1:5189/?playground** with the
local server running. The Experiences menu also offers **Keeper’s Playground**
and **Lighthouse disco** (`?playground&disco`). This desktop experiment starts in
the station yard, constructs no Story, and opens no watch save. It is local and
is an optional toybox, separate from the authored story.

## Admiralty No. 03 gravity grabber

An original articulated model built in the native renderer: aged brass, copper
windings, ivory ceramic, blued steel, ribbed leather, a return hose, induction
rotor, three hinged fingers, a live pressure needle and an engraved maker stamp.
It has 29,348 triangles in 28 merged parts. Blender MCP was not available during
this implementation; no Blender command line, Python, or other Blender interface
was used. The model requires no external asset downloads.

| Input | Action |
|---|---|
| Click / X | Grab the aimed prop; click again to gently release it |
| Hold right click / C, then release | Charge and throw the held prop |
| Wheel | Bring the held prop nearer or farther away, 1.4–7 m |
| Hold R | Turn a suspended prop |
| Q | Drop |
| G | Replace/reset the nine playground props in front of you |
| F9 | Equip / holster; switches away from the minigun |
| J | Start / stop lighthouse disco |
| Backtick | Open named toy and disco controls |

Six striped buoys and three supply crates are movable. Historical furnishings,
buildings, wildlife and inventory are not converted to physics objects. A damped
spring suspends a selected prop; its three energy threads and halo show the grip.
Walls and terrain block acquisition and constrain the carrying distance. Throwing
uses bounded, substepped physics with ground bounce, friction, prop separation and
ordinary-water buoyancy; active coastal events also push submerged props.

The colliders are sphere/capsule approximations, including the crates. Rotation
is decorative rather than a rigid-body torque simulation. Crates can be piled,
but they do not have exact box-contact stacking. Reset reuses a fixed pool. Props
beyond 450 m or below -140 m hide until reset. Menus, photo mode, holstering,
uncarried fly-camera views and lost input release the prop and suppress the tool.
Station doors and gates still work with E. The gravity hum follows the existing
sound mixer and mute control.

## Lighthouse disco

The actual lighthouse’s volumetric beams sweep in four independently colored
directions. Prism, Aurora and Sunset palettes also color moving local lights
around a tiled mirror ball on a temporary yard gantry. **Watch the light show**
puts the player outside the compound; **Return to station yard** returns to the toys.

The controls expose tempo (40–160 BPM), brightness, mist, freeze, gentle motion
and an optional original Web Audio synth beat. Music starts off. The beat uses
the game’s existing mixer; M mutes it with the rest of the scene. Opening the
debug menu stops the music, and returning resumes it when enabled. There is no
strobe. Gentle motion reduces the sweep and removes light pulsation; it defaults
on when the browser reports reduced motion.

Disco temporarily selects a frozen evening clock and denser mist. Stopping it
restores the previous time, clock speed, haze, lamp state, beam palette and spread,
disables the temporary fixtures and stops scheduled music. Its options are not
written to storage. Graphic settings, weather and extreme events remain available
through the existing menu.

## Verification

- `npm run test:playground`: aimed acquisition, wall blocking, stable holding,
  distance/rotation, charged throwing, input/UI gates, ordinary buoyancy, bounded
  pools, freeze and full disco restoration; native front/rear model renders.
- `npm run test:playground-island`: full island renderer, suspended prop and tether,
  all three colored lighthouse palettes and stopping the disco, with strict
  WebGPU shader/validation checks. Captures are in `artifacts/playground/`.
- The existing `npm test` and dev minigun checks cover retained behavior. Browser
  inspection checks the actual playground and named menu controls.

These checks do not establish physical speaker audibility, sustained performance,
phone/headset controls or subjective acceptance of the model and lighting.
