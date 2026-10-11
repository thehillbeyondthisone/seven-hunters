# Older island and January ecology

Archaeology and winter pass, 11 October 2026. Open `/island-history.html` for save-free review links.
The chapel, bothies and winter ecology also appear throughout ordinary play.

## Archaeological evidence

The [RCAHMS chapel survey, 4 June 2014, NRHE 3971](https://canmore.org.uk/site/3971/flannan-isles-st-flannans-chapel)
records a 2.5 × 1.5 m chamber and a western entrance only 0.45 × 0.95 m internally.
The older [Western Isles HER account](https://her.cne-siar.gov.uk/Monument/MWE3971)
gives different doorway dimensions and records rebuilding. The later measured survey
governs this model. The opaque doorway card and whole-building collider are removed;
wall and lintel collision preserve the actual narrow opening. A reversible low inspection
view is available through the normal interact button. This is a viewing aid, not a
claim that an upright adult fits. Physical XR head position is not moved.

The [bothy archive, NRHE 3973](https://www.trove.scot/place/3973) describes connected
chambers, corbelling and a small hearth. The 2014 survey distinguishes a larger
bothy from a smaller possible store to its WSW. Earlier map annotations and accounts
disagree about roof survival. The model uses hollow chambers, partial corbels and
an eastern crawl passage; individual stones and losses are artistic reconstruction.
The main clear chamber is 2.4 × 2.7 m; the western cell is 1.8 × 1.4 m.
The smaller chamber uses the earlier measured 10½ × 3½ foot account (about 3.2 × 1.07 m).
Neither exact January 1901 roofs nor a monastic origin are established.

Relative grid locations use [the lighthouse record](https://www.trove.scot/place/171215)
as anchor, with an approximate 4.8° conversion from grid to true north. This moves
the chapel from the previous x=-8 to x=-35, z=50, and places the bothy group near
x=-335, z=12. These are approximate local alignments, not survey-grade georeferencing.
Existing DEM smoothing and station grading remain. Worn foot tracks branch from the
west tramway and stop at entrances; their exact alignment, slab boundary, ruin height
and floor finish are reconstructed. No modern visitor facilities are added.

Martin Martin's 1703 account is presented as a historical report of visits and prayers,
not proof of the chapel's date or saint. The archive reader notes distinguish evidence
from reconstruction. Older saves and their story flags are unchanged.

## January ecology

[NatureScot's Flannan Isles conservation and management advice](https://www.nature.scot/sites/default/files/special-protection-area/8502/conservation-and-management-advice.pdf)
describes maritime grassland and separates breeding seasons from winter distribution.
Puffins spend winter at sea; kittiwakes largely disperse, and the Flannan razorbills'
specific winter whereabouts are unknown. Modern colony counts do not determine
January 1901 populations. Fulmars are recorded from the 1900s, which does not establish
a resident colony for this particular January. None of those colony populations is added.

[RSPB herring gull guidance](https://www.rspb.org.uk/whats-happening/news/seven-seabirds-you-could-see-this-summer)
and [great black-backed gull guidance](https://www.rspb.org.uk/birds-and-wildlife/great-black-backed-gull)
support year-round coastal occurrence. Four independently timed birds make occasional
flap/glide passages, including a dark-backed bird that rests and takes flight if approached.
Long gaps with no visible birds are deliberate. Population, routes and local occurrence
are plausible regional reconstruction, not an island census for 1901. Tropical gull
hoods are removed from Flannan birds, including the existing three-gull reveal.
Ambient birds are suppressed during that reveal and in darkness. `noWildlife` and `lite`
disable them. Terns, pelicans, frigatebirds and tropical songbirds remain excluded.

Calls come from visible birds within 145 m, spaced 42–97 seconds apart, and respect
daylight, immersion, shelter and audio disable state. Herring yelps and lower hoarse
black-backed barks are procedural sound interpretations, **not field recordings**.
The previous unidentified gull recordings are no longer randomly emitted on Flannan.
No third-party audio was downloaded or relabelled. Speaker audibility and species
likeness require listening review; automatic audio gating is a separate check.

[NatureScot's St Kilda habitat advice](https://www.nature.scot/sites/default/files/special-area-conservation/8383/conservation-and-management-advice.pdf)
provides a regional maritime-grassland analogue: fine fescue, thrift and sea plantain.
Seeded patches of low strap leaves and compact thrift foliage supplement the existing
short turf. January has no pink flowers or summer heads. Paths, buildings, water,
bare outcrops and steep slopes are excluded. This is regional botanical interpretation;
no species inventory for Eilean Mòr in 1901 is claimed.

## Verification

- `npm run test:island-history`: real terrain/station collision, crawl threshold and
  passage clearance, deterministic off-path foliage, twenty-minute ecology simulation,
  quiet intervals, bird clearance and response, darkness/pause/reveal gates, audio gates.
  It also runs `test/ruin-inspection.mjs`: actual walking along all three approaches,
  selectable targets, paused watch/held player, camera/input restoration, unchanged flags,
  protected normal save and no XR head-pose override.
- `node test/stone-masonry.mjs`: packing, closed stone volumes and opening clearance.
- `npm test`: existing game/story/save, terrain, walking, engine and mobile-input checks.
- `npm run build`: production compilation.
- `node tools/shots/island-history.mjs after`: native game views, including doorway,
  chamber, bothies, cover and dusk. Outputs and GPU errors are in `artifacts/island-history/`.

The initial `before-*` capture attempt had an invalid camera orientation and is excluded
from visual evidence. After renders are reviewed on their own. Desktop rendering does
not establish physical Quest/mobile performance, speaker audibility or historical likeness.
The extra foliage is one merged material draw; birds add one four-instance draw.
The release includes the source notes and save-free study page.

Verified locally: the focused suites, existing `npm test`, stone-masonry checks and
production build passed. Native renders reported no GPU validation errors. Chapel
approach, low doorway, interior, bothy approach/chambers and afternoon light were inspected.
Ecology detail captures are separate from the broader architecture views. Call scheduling
and gating passed automated checks; panner routing was reviewed in code. Speaker audibility
and species likeness remain listening checks.
