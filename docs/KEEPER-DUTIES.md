# Keeper's duties: first-night study

Direction agreed on 5 October 2026: duties should teach the work of keeping a
lighthouse in 1901. Use meaningful apparatus states, observation and physical
causes; avoid timing challenges, invented repairs, points and completion meters.

## Review

Run `npm run dev`, then open `keeper-duties.html` or `?keeperPreview`.
The study starts in the lantern before sunset, uses a separate
`sevenhunters.keeper-duty-preview.v1` save, and leaves normal-watch behavior and
saves intact. It supports the existing desktop and touch controls.

The player examines an already prepared lamp, winds the clockwork, lights the
burner at sunset, releases the machine's stop, and inspects the working apparatus.
The existing ratchet, moving crank, lamp warm-up and lens rotation provide the
feedback. Winding stores mechanical work without automatically starting the
machine in this preview. Stopping the clockwork leaves the flame burning while
rotation slows. The player can see the distinction and restart it.

After verifying the working light, the first night teaches the weight drive.
Guidance leads through the actual hatch to the upper tower stair. The study
exposes one side of the central weightway so the iron weight and cable can be
seen. Examine the weight with E, watch its descent, then return to the crank and
raise it again while the optic continues turning. The weight's height and the
cable length are derived directly from `Lamp.wind`; the brake holds its height.
No separate animation invents movement or drains the weight faster for the lesson.

The observation records a visible 18 cm change in height while the player is
looking at the weight after examining it. This is an authored readability
threshold, not a timer, a measured period specification, or a completion meter.
Pausing, opening debug or a paper, looking away, and stopping the mechanism do
not by themselves complete the observation. The subsequent winding lesson
records an actual rise while the mechanism runs. Existing study saves keep their
apparatus state and continue into this new lesson without restarting; new lesson
flags live in the same isolated preview save.

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
| Exposed side of the weight tube, five modeled iron discs, cable thickness, travel through this tower, and lesson observation threshold | Authored teaching reconstruction, present only with `keeperPreview`. No claim that Flannan had this opening, these weight dimensions, or this exact drop length. The normal station retains its original closed tube and the same stair/newel colliders. |
| Small brass stop beside the crank, ten-second winding, three-hour modeled weight run, eighteen-second warm-up, and descriptions of this prepared handover | Authored reconstruction/compressed handling. Exact Flannan control layout, winding duration, burner model, oil quantities, number of wicks and servicing intervals remain unverified. |

The teaching paper is explicitly authored, with source and reconstruction notes.
The warm-up and mechanical state are supplied by the existing game simulation;
they do not establish engineering fidelity.

## Next duties

1. Show inspectable oil supply and burner condition, with interventions tied to
   visible evidence. Confirm the original burner before adding specific valves,
   wick geometry, pressure or quantities.
2. Make weather observations come from readable instruments, flags/smoke,
   sea state and visible landmarks. Let the slate record what the player saw;
   remove the feel of choosing an answer to a quiz.
3. Make dawn preparation a coherent routine: extinguish, attend to apparatus,
   record consumption where evidence supports it, and write up the slate.
4. Teach the routine thoroughly once. Later watches use brief condition-based
   reminders and allow familiar work to be compressed.

## Verification

`npm run test:keeper` checks real apparatus and stair targets, the weight and cable
state, the brake holding descent, observation requiring physical movement, winding
while running, old/new preview saves, and normal-save isolation. `npm test` covers
the existing first-night and later-story flows, stair movement, guidance, renderer
smoke checks and touch input. `node tools/shots/keeper-weight.mjs` renders the same
weight from one actual stair pose before and after a simulated descent into
`artifacts/keeper-weight/`. These checks do not establish physical-device acceptance.

This study implements first lighting and the first-night winding lesson, not a
complete keeper simulator. The instrument-led weather round is the next addition.
