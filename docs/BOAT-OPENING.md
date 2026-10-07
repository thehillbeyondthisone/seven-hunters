# The playable crossing

Fresh nights begin at 13.30 in an open landing boat approaching the east stage, rather than at
13.40 ashore with a retrospective prologue. The view is from the forward seat, with mouse look,
subtle motion over the ocean and the island approaching over ninety seconds. Movement keys do
not walk the passenger off the boat. Enter can bring the landing closer; a separate Enter at
the stage steps ashore. The landing is logged once, the boat departs, and the existing climb
and night continue at 13.40.

B opens the Papers packet aboard and throughout the night. The home letter assumes there
will be other keepers for company; the posting establishes the work; Moore's account offers
only the contemporary record. All reading is optional. A single modal contains the index
and the papers, so moving between them never advances the approach. Waiting at the stage
also costs no daylight. Free camera and photo mode hold the approach.

The current night save key and v1 format remain compatible, with an optional `voyage` field
for new crossings. Old saves resume ashore. `?arrivalPreview` uses a separate save key and
does not clear or replace a normal saved night.

The personal letter, posting and arrival are fictional. The Moore paper paraphrases the
28 December 1900 letter transcribed by the Northern Lighthouse Board:
https://www.nlb.org.uk/history/flannan-isles/
It does not use the 8 January 1901 investigation report, which is later than this scene.
The landing boat and rower are provisional procedural reconstructions. No dimensions,
paint colours or boatman's identity are claimed as archival fact. Voices are subtitles.
The distant Hesperus is mentioned but is not yet modelled.

Verification:

- `npm test`: fishing regression, Flannan geometry, landing-to-balcony route, full night,
  crossing movement and reading pause, mid-crossing saves, legacy saves, departure,
  guidance projection/routing and WebGPU engine smoke.
- `npm run build` and `git diff --check`.
- `npm run shots -- --views=dCrossing,dBoatPapers,dBoatLanding --w=960 --h=540 --frames=24
  --params=setting=flannan --tag=boat-arrival --out=artifacts/boat-arrival --adapt`.
- Local browser inspection of packet navigation, personal letter, historical source details,
  continue-aboard flow, landing transition and rereading ashore. Physical audio and performance
  acceptance remain user playtest checks.

Review board: `artifacts/boat-arrival/index.html`. Story desk updated to include the crossing.

## Boat visual and flotation pass, 4 October 2026

The open boat now has nine overlapping clinker strakes, a fuller curved hull, bent frames,
seat risers, thwart knees, longitudinal duckboards, copper fasteners, cream sheer trim,
painted lower strakes, breast-hooks, cleats and bronze rowlocks. Tapered oars have leather
sleeves; the boatman has moving sleeves, an oilskin coat, wool cap, trousers and boots.
The stores include a slatted chest with straps and latch, tied and sealed papers, a canvas
bag and rope. Boat-specific shaders keep grain, paint wear and dampness attached to the
boat instead of applying the village's world-height tidal algae to moving floorboards.
These are artistic details, not newly verified historical dimensions or finishes.

Nine sea probes cover the bow, stern and both sides. Pitch and roll follow the sampled
surface within comfortable limits. A floor-clearance envelope raises the hull immediately
over rising crests and eases it down into troughs, accounting for readback age and rising
wave speed. Distant readbacks from the origin or a skipped route position are rejected.
The title screen, papers, free camera and photo mode hold the journey clock while the
hull continues floating. The water exclusion volume now follows the actual tapered hull.

Validation: `npm run test:boat` exercises a three-frame delayed uneven sea at 120, 30 and
12 fps, including pause and departure. `npm run test:boat-sea` runs the real FFT/shore
surface and Story update for 155 simulated seconds at a 0.1-second timestep, checks the
passenger lens and underwater state, and saves measured results to
`artifacts/boat-visual-pass/final/flotation.json`. It also renders the crossing, papers,
crew, exterior and landing cameras. `npm test`, `npm run build` and `git diff --check`
passed. The local browser title screen and papers were inspected above water; physical
audio, controller behavior and performance remain playtest checks.

Review board: `artifacts/boat-visual-pass/index.html`. The preview remains
`http://127.0.0.1:5189/?arrivalPreview`, using its separate save key.

## Intro lessons, 5 October 2026

The opening now explains the tender, landing boat, relief and fortnight aboard. On the
first walk ashore, captions introduce the two landing places, hauling tramway, families
at Breasclete, the station's recent establishment and the three missing keepers. The
milestones project onto the actual graded east flight and tramway; island-wide height
alone cannot trigger them. They leave walking and looking under the player's control.

Passages have a reading allowance based on their length and six seconds of quiet between
them. Papers, photo mode, backgrounding and the hilltop reveal hold the caption clock.
Saved flags retain the current passage and its remaining time, without replaying finished
lessons on a return trip. On entering the yard, an active passage finishes before the
keepers' introduction; queued route passages are dropped so they cannot trail into the
house. A hurried player can therefore miss a caption, but every topic remains in Papers.
The captions end on entering the keepers' room. Existing saves already beyond the climb
do not acquire the new arrival scene.

Five historical background notes join the existing packet. B reopens it ashore; on touch
screens use Tools, then Papers. Each note is visibly identified as writing for the game,
with expandable provenance and direct source links. They explain unfamiliar words without
presenting new text as an archival prop. The Board's contemporary account supplies the
keepers and Moore's December letter; its station history supplies the landings, Breasclete
and 1899 establishment. Historic Environment Scotland supplies the stairs and tramways:

- https://www.nlb.org.uk/history/flannan-isles/
- https://www.nlb.org.uk/lighthouses/flannan-islands/
- https://portal.historicenvironment.scot/designation/LB48143

This pass ends at first entry into the lighthouse yard. The existing hilltop reveal remains
clear of captions. The Morse practice, Cate naming decision and tower ascent options belong
to later passes.

Validation: `npm run test:intro` checks route gates, readable pacing, pauses, save continuation,
one-time delivery, yard closure and source coverage. `npm test` includes that suite and checks
the actual landing-to-yard walk, continuing story, mobile input, stairs and engine smoke.
`npm run build` and `git diff --check` passed. Browser inspection covered the live boat packet,
source disclosure and journey pause, with caption and packet layouts checked at 844×390 and
390×844. These are browser viewport checks, not physical-phone gesture or performance proof.

For repeatable UI review, use `test/story-ui.html?view=intro&mobile&cue=rails`,
`?view=intro&mobile&cue=yard`, `?view=intro-boat` or `?view=papers&mobile`.
The playable `?arrivalPreview` keeps using its separate save.
