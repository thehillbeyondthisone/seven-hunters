# The playable crossing

Fresh nights begin at 13.30 in an open landing boat approaching the east stage, rather than at
13.40 ashore with a retrospective prologue. The view is from the forward seat, with mouse look,
subtle motion over the ocean and the island approaching over ninety seconds. Movement keys do
not walk the passenger off the boat. Enter can bring the landing closer; a separate Enter at
the stage steps ashore. The landing is logged once, the boat departs, and the existing climb
and night continue at 13.40.

E opens a packet aboard. B reopens it throughout the night. The home letter assumes there
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
