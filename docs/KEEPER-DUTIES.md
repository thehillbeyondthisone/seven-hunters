# Keeper's duties: first-night study

Direction agreed on 5 October 2026: duties should teach the work of keeping a
lighthouse in 1901. Use meaningful apparatus states, observation and physical
causes; avoid timing challenges, invented repairs, points and completion meters.

## Review

Run `npm run dev`, then open `first-watch.html` to review the arrival at the house
and the full first watch in a separate `sevenhunters.first-watch-preview.v1` save.
`?firstWatchPreview=crossing` includes the boat and climb. The normal route now
includes the routine for new watches. Saved arrivals before the first lighting
adopt it without replaying, changing position or resetting the clock or apparatus.
Existing watches already past first lighting without `flags.keeperRoutine` keep
their original duties, closed weight tube and hold controls.

Open `keeper-duties.html` or `?keeperPreview` for the shorter apparatus study.
The study starts in the lantern before sunset, uses a separate
`sevenhunters.keeper-duty-preview.v1` save, and leaves the normal save intact.
Both routes support the existing desktop and touch controls. Arrival and the
Board's letter retain priority over the apparatus lesson. At dawn, the existing
extinguishing and journal sequence resumes; later watches compress familiar work.

The player examines an already prepared lamp, winds the clockwork, lights the
burner at sunset and releases the machine's stop. The cutscenes demonstrate the working apparatus, so no second examination is required.
These actions are available in that order, one at a time. The lamp cannot be used
while winding is required, and the stop cannot be released before the burner is
lit and the weight fully raised. After the cutaway, the player goes straight to
winding again. Passing time unlocks after that second winding.
During the watch, the keeper can top up the weight before the warning. Once
winding begins, passing time waits until the weight is fully raised again.
Saved watches resume the same order.
The existing ratchet, moving crank, lamp warm-up and lens rotation provide the
feedback. Winding stores mechanical work without automatically starting the
machine in this preview. Stopping the clockwork leaves the flame burning while
rotation slows. The player can see the distinction and restart it.

The first lighting of the burner plays a twelve-second view from outside the
lantern (`src/story/FirstLightCutscene.js`). The camera swings about 110° round
the top of the tower, easing out and up, while the flame warms. It starts as near
as it can to the side opposite the sun, and keeps to a gap between the bullseye
beams so a beam never floods the frame. The burner warms 2.2× faster during the
shot; the optic stays still. Two timed captions explain the stationary flame,
the revolving optic and the brass clockwork stop. A music cue (`FIRST_LIGHT_MUSIC`, file
`public/audio/first-light.mp3`, about 30 seconds, hopeful into unsure) starts
with the shot and plays on after control returns, including through the weight
cutaway. A missing file plays nothing. Escape or Continue skips the view; the
music continues. It plays once per duty record and does not resume after a reload.
`node tools/shots/first-light.mjs` renders review frames to `artifacts/first-light/`.

The first stop release after fully winding starts a twelve-second sequence in the
actual station. The first eight seconds look into the existing exposed iron column
below the upper landing. The modeled iron weights visibly descend on their cable
against the stationary tube and stair treads. A short fade cuts back to the revolving
optic and its stationary burner. Both shots use the game's materials, lighting,
render treatment, machinery sound and existing story-caption typography. The
schematic screen, grid, numbered stages and diagram animations have been removed.

The ordinary watch clock runs during the sequence. Weight height and cable length
continue to derive from Lamp.wind; optic rotation comes from Lamp.angle. There is
no separate fall animation, extra time acceleration or temporary reset of the
weight. The player remains at the crank while only the camera changes views.
The carried lantern provides its usual illumination from outside the frame.

The sequence finishes automatically or can be skipped with Escape or Continue.
Movement, interaction, papers and guidance remain suspended until the original
camera view and controls return. Hidden tabs, pause and debug hold its progress.
Unfinished saves retain the timeline and original camera view; completed scenes
do not replay. A partial winding or empty weight does not trigger it, and an
unlit burner remains unlit. Older schematic cutscene saves resume in the live view.

After the sequence, raise the weights again while the optic continues turning.
There is no hatch examination or repeat lamp inspection. Existing
completed weight observations count as learned; unfinished studies retain their
apparatus state and are directed to fully wind and release the stop.

The room's first arrival adds one quiet passage and Walter's kitbag beneath the
entrance shelf. The bag's optional inspection recalls Mary's existing letter.
The door's actual opening admits wind and surf near the threshold; further inside
the room remains sheltered. The wall clock and footsteps stay on the dry audio
bus. Room lighting concentrates on the desk and table; the stove stays cold.

Instruction appears in the approved quiet margin. The crank has no progress
meter. There is no score or penalty for inspecting again while the apparatus
settles. The preview's first inspection reports sound equipment; it does not
manufacture grime or damage merely to create a task.

## Evidence and reconstruction

| Claim or design | Evidence / boundary |
| --- | --- |
| Prepared lamp, filled oil fountains/canteens, cleaned lens and machinery | [NLB's Flannan records](https://www.nlb.org.uk/history/flannan-isles/), including Muirhead's 8 January 1901 report. The game may use this as research; it must not place that later report in Walter's 3 January papers. |
| Night watch and checking the light's character; daytime maintenance | [NLB: Lighthouse Keeping](https://www.nlb.org.uk/history/lighthouse-keeping/). This page covers the broader manned service, including later technology; it is not a 1901 equipment manual. |
| Sunset-to-sunrise service, morning cleaning, even wick trimming, store accounts and journal | [Trinity House's 1839 instructions](https://trinityhouse.co.uk/about-us/history-of-trinity-house/from-the-archives/instructions-for-lighthouse-keepers-1839). Comparative period evidence from a different authority. Do not adopt its servicing intervals as Flannan specifications. |
| Original hyper-radial optic | [Museum object SLM.1997.9316](https://www.goindustrial.co.uk/collections/lighthouses-museum/collection/prism-flannan-isle); see the existing reference notes for the original photograph. |
| Winding takes up cable and raises a weight; its governed fall drives the revolving optic | [St Augustine Lighthouse Museum's mechanism explanation](https://www.staugustinelighthouse.org/2015/12/16/lighthouse-technology-clockwork-mechanism/) and [Parks Victoria's surviving nineteenth-century weights](https://victoriancollections.net.au/items/5b7383d121ea671328cd0dbc). Comparative evidence from other stations, not Flannan engineering drawings. |
| Exposed side of the weight tube, observation slot in the upper landing, five modeled iron discs, cable thickness, travel through this tower, and the exposed view used by the cutscene | Authored teaching reconstruction, present in the study and new first watches. No claim that Flannan had these openings, these weight dimensions, or this exact drop length. Legacy saves retain the closed tube. Story stair travel uses 2.8-second actions with a visible first step and words under black; the newel remains solid. |
| Small brass stop beside the crank, ten-second winding, three-hour modeled weight run, eighteen-second warm-up, and descriptions of this prepared handover | Authored reconstruction/compressed handling. Exact Flannan control layout, winding duration, burner model, oil quantities, number of wicks and servicing intervals remain unverified. |

The teaching paper is explicitly authored, with source and reconstruction notes.
The warm-up and mechanical state are supplied by the existing game simulation;
they do not establish engineering fidelity.

## Next duties

### Morning servicing preview

`morning-servicing.html`, `?morningPreview` and `?morningPreview=familiar` now
provide separate first and familiar dawn studies. Their saves are
`sevenhunters.morning-servicing-preview.first.v1` and
`sevenhunters.morning-servicing-preview.familiar.v1`. Restarting either study
clears only that slot. Normal-watch dawn progression is unchanged.

Extinguish and stop the machine, inspect the representative overnight condition,
fetch the kit and can from the enterable oil store, fill and cap the can, and carry
both to the lantern shelf. With the optic stationary, open the service section,
wipe the glass and housing with separate cloths, dress the generic wick edge,
replenish the working oil supply, secure its cap and close the apparatus. Raise
the weight with the machine stopped and examine the prepared apparatus. Return
the can and kit, separate used oily cloths into the covered receptacle, secure the
store, and copy the slate and actual work into the journal. Signing leaves the
player free to explore the quiet morning. The familiar study groups cleaning and
wick preparation while retaining the other physical actions.

The store interior, service opening, vessel dimensions, tools and wick work are
explicit teaching reconstructions. The initial night slate, deposits and oil
levels are authored examples, not measurements from a played night. Oil moves
between finite internal stores without creation or loss; the amounts have no
historical unit or claimed capacity. There is no combustion-rate or temperature
simulation, no measured consumption claim and no specific burner identification.
Muirhead's 8 January report remains research in the authored notes, never a paper
Walter could possess on 3 January. Ordinary sound fittings need no repair.

`npm run test:morning` checks both routines, selectable targets, safe apparatus
states, opening-side access, conservation, partial oil/cleaning resume, real
coasting resume, pause/menu/background gates, touch holds without meters,
duplicate prevention and save isolation. Its walking test completes both store
trips and every service action through the real doors, using the 2.8-second tower
travel actions between levels, for both first and familiar dawn. `npm run shots:morning` writes
engine-rendered review views under `artifacts/morning-servicing/`.
`test/morning-browser.html?morningPreview` (or `=familiar`) runs that same route
inside the actual browser renderer and opens the real journal for signature;
it writes no saves. This is automated walking and selection QA, not a manual
playthrough or a physical touch/audio acceptance test.

On 9 October 2026, both browser routes reached the actual journal, were signed,
and remained in quiet exploration without browser console errors. The normal
touch entry, saved-preview continuation, named extinguish action, Tools and
authored Papers disclosure were also checked in the app browser. The seven
engine views were inspected for storage, carrying, open access, wiping, pouring
and prepared conditions. `npm run test:morning`, `npm run test:keeper`,
`node test/demo-story.mjs`, `npm test`, `npm run build` and `git diff --check`
passed. Physical-device handling and audio remain unverified.

1. Review the isolated morning service before promotion. Confirm the original
   burner before adding specific valves, wick geometry, pressure or quantities.
2. Make weather observations come from readable instruments, flags/smoke,
   sea state and visible landmarks. Let the slate record what the player saw;
   remove the feel of choosing an answer to a quiz.
3. Promote the reviewed dawn routine into new watches in a separately approved
   pass; record measured consumption only where evidence supports it.
4. Teach the routine thoroughly once. Later watches use brief condition-based
   reminders and allow familiar work to be compressed.

## Verification

`npm run test:keeper` checks the full-wind stop-release trigger, cutaway pause/resume/skip,
one-time completion, the weight and cable state, the brake holding descent, winding
while running, old/new preview saves, and normal-save isolation. `test/keeper-weight.html` reviews the live sequence in the running game. Its
`?still=weight-start`, `?still=weight-end` and `?still=optic` views support visual
comparison. `test/weight-cutscene.html` forwards to that same review. `npm test` covers
the existing first-night and later-story flows, stair movement, guidance, renderer
smoke checks and touch input. `node tools/shots/keeper-weight.mjs` renders the same
column before and after the real descent, the optic and the return to the crank into
`artifacts/keeper-weight/`. `node test/first-watch.mjs` checks door-dependent
shelter and the room passage's pause/resume behavior. `node test/demo-story.mjs`
now plays the new first-lighting sequence through dawn and the existing
continuation, and checks the new review slot and legacy controls.
`node tools/shots/first-watch.mjs` renders the entry, kitbag, desk and apparatus
from the running engine into `artifacts/first-watch/experience/`. These checks do
not establish physical-device acceptance or speaker audibility. The live column and optic shots are reviewed in the browser alongside
their captions, independent burner state and return to the crank.

The evening study implements first lighting and the first-night winding lesson.
The instrument-led weather round is now present, and the morning service remains
an isolated study pending review; this is not a complete keeper simulator.
