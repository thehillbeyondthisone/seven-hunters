# Unpacking and the Brownie

New watches introduce Walter's own belongings after the first lamp, optic and
driving-weight routine. Return to the kitbag beneath the entrance shelf in the
keepers' room. E, or the touch action button, performs one action at a time:

1. Unbuckle and open the canvas bag.
2. Lay the shirt and damp blue stockings on the empty chair. This recalls Mary's
   letter from the crossing.
3. Unwrap the small parcel to reveal the Brownie.
4. Set the camera and Mary's folded note beside the journal.
5. Walk to the desk and examine them. The inspection describes one loaded roll,
   six square pictures, the sight lines, shutter, winding key and red window.

Each action changes the real scene geometry and supplies a short thought using
the existing caption system. The player retains walking and look control.
There is no forced turn or new supernatural incident.

The watch clock holds while the opened bag or camera introduction is unfinished
and the player remains in the room. Leaving the room releases the hold.
Clockwork runs visually, while its weight retains the existing game-time rate.
Winding warnings, due observations, the gate and signals take objective priority;
they release the scene's clock hold. Normal watch skipping resumes after the
camera has been examined. Reading the Brownie through Papers also completes the
inspection once it has been placed on the desk.

The scene saves each action and the current caption with the existing version-1
watch. Pause, reading, photo mode, free camera and background tabs hold the
caption and prevent scene actions. Established saves without the scene flag
receive no forced unpacking objective; the bag remains available for a voluntary
introduction. Saved arrivals before first lighting adopt the scene without
moving the player or resetting their time. Completed scenes retain the objects
without replaying the captions.

## Local review

`public/unpacking.html` links to `?unpackingPreview` and its touch variant. The
preview begins in the room at 15.39, with a working light and completed initial
duties. It uses `sevenhunters.unpacking-preview.v1`; the normal save remains
`sevenhunters.night1.v1`. `first-watch.html` also links to this review.

## Historical boundaries

The camera represents **The Brownie introduced in February 1900**, appropriate
to the game's January 1901 setting. The National Science and Media Museum's
curator describes a 5 x 3 x 3 inch imitation-leather-covered card-and-wood box,
a meniscus lens, rotary shutter, optional separate viewfinder, and six 2¼-inch
square negatives on 117 roll film. The geometry follows those proportions and
uses top sight lines rather than a later Brownie's integral viewfinders. Fine
control positions and material finish remain approximate.

- [National Science and Media Museum: the original Brownie](https://blog.scienceandmediamuseum.org.uk/a-z-photography-collection-b-is-for-brownie/)
- [Science Museum Group: surviving box camera and packaging](https://collection.sciencemuseumgroup.org.uk/objects/co8406729/no-1-brownie-box-camera)
- [Early Photography collection: 1900 model and sight lines](https://www.earlyphotography.co.uk/site/entry_X30.html)

Walter's ownership, Mary's gift, her note and the belongings are authored
fiction. This implements the **introduction**. Exposure capture, a held camera,
film winding and the developed-film epilogue remain future work from PLAN §3.6.
The game does not spend exposures or show invented instant prints here.

## Verification

- `node test/unpacking.mjs`: actual standing interaction targets, real-controller
  walk to the desk around furniture, named touch actions, scene changes,
  game-time/weight hold, duty priorities, pause states, save/resume at each step,
  completion, legacy arrivals and normal-save isolation.
- `npm test`: includes this focused test and the complete first-night/chapter
  continuation, keeper, movement, guidance, engine and mobile input suites.
- `npm run build` and `git diff --check`.
- `node tools/shots/unpacking.mjs`: six application-rendered review views in
  `artifacts/unpacking/`, with WebGPU shader and validation checks. These show
  the closed/open bag, revealed camera, desk detail and furnished room.

The local in-app browser loaded the scene, displayed the named E interaction,
opened the bag through actual keyboard input, and displayed the Brownie
inspection and Mary's note. No browser console errors were reported during
that review. The final six rendered views were visually inspected after the
canvas-rim correction. Physical touch hardware, headset behaviour, speaker
audibility and sustained performance are unmeasured.
