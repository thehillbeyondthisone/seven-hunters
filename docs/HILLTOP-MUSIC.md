# The First Look Back — music brief

Status: the user-supplied Suno track `public/audio/the-three-note-reach.mp3` is selected in `RevealMusic.js` for the hilltop cutscene. It plays alongside the live island ambience through the existing 45-second cue. The notes below record the composition brief; final timing and balance need in-scene listening review.

## Walter's feeling

He has reached the top of the climb. His body can finally stop working long enough for the place to reach him. The winter sun and the birds are beautiful; the boat is carrying the last human company away. Mary's place at the table is suddenly a long way off. When he faces the lighthouse again, its ordinary work gives him something to hold onto.

The thought beneath the cue: **I wish someone were here to see this. I still have a light to keep.**

This is a proposed musical reading of the existing opening, grounded in `Script.js`, `IslandReveal.js`, and the fixed story document. It does not introduce a new story event or imply a supernatural explanation.

## The sound

A small acoustic ensemble: one intimate fiddle, warm bowed cello, and a few spacious upper strings. A slow, unhurried pulse around 54 BPM, with the flexibility of a person's breathing. Subtle Scottish modal colour; restrained ornament and natural bow texture. A short melody that rises toward something just out of reach, then falls gently back. Tenderness and awe lead; loneliness and uncertainty sit underneath them.

The largest swell belongs to the open water and the gulls. It should still feel like one person's private realization. As the lighthouse returns, the cello becomes steadier and the arrangement thins. Leave room for the actual wind, gulls, and boat in the game mix.

## Picture and emotional timing

The original 21-second camera sequence now runs at 0.75x speed, taking 28 seconds. The cue keeps its original speed and lasts 45 seconds, continuing into the walk toward the station. The generation prompts below retain the original composition brief.

| Cue time | Picture | Musical direction |
| --- | --- | --- |
| 0–1.33 s | Settle after the climb | Near silence; a very soft bowed breath begins. |
| 1.33–8 s | Turn left through the low sun | Warm cello and open strings widen gently; the first fragile fiddle phrase emerges. |
| 8–18.67 s | Open sea, departing boat, gulls | The melody lifts into the cue's one broad, restrained swell. Beauty opens into homesickness. |
| 18.67–28 s | Turn back toward the lighthouse | The high strings recede. Cello holds a quiet, measured figure beneath an unfinished melody: duty and resolve. |
| 28–37 s | Control returns; walk toward the station | A smaller echo of the theme, with a little warmth and room between phrases. No second climax. |
| 37–45 s | Continue walking | Instruments fall away naturally. Let the last open interval decay into the live sea and wind. |

These are editing targets. A plain-text AI prompt cannot establish exact hit points; select and edit the rendered music against the actual scene.

## Main generation prompt

```text
Compose a 45-second instrumental cinematic chamber-folk cue titled "The First Look Back". A newly arrived lighthouse keeper in the Scottish islands, winter 1901, has finished a hard climb. He turns through the low sun toward a vast ocean, watches gulls and the boat carrying his last company away, then turns back toward the lighthouse he must tend alone. His feeling is breathtaking beauty, sudden homesickness, vulnerability, and quiet resolve.

Intimate solo fiddle with natural bow texture, warm bowed cello, a few airy upper strings; subtle Scottish modal colour, around 54 BPM with gentle rubato. A simple, memorable three-note phrase rises as if reaching for home, then softly falls. Spacious acoustic production, expressive small-ensemble performance, long but clear reverberation, and plenty of air between phrases.

Begin almost silently and become audible within the first two seconds. Open gently through seconds 1–6. Let the melody make one broad, restrained swell around seconds 6–14: beautiful, tender, and aching. From seconds 14–21, thin the high strings and give the cello a steadier, quiet figure as he faces his work. Continue with a softer echo of the theme through seconds 21–37. Dissolve naturally by 45 seconds, leaving the final open interval slightly unresolved. Emotional restraint, human warmth, a small foothold of courage within an immense landscape.

Entirely instrumental. No voice, humming, choir, percussion, drum beat, bagpipes, folk dance, pop-song structure, epic trailer climax, horror sting, aggressive dissonance, or recorded wind/birds/ocean sound effects.
```

## Short Styles prompt for Suno

Use Custom mode with Instrumental enabled. Paste this into Styles; leave lyric text empty. Title: **The First Look Back**. If your interface provides an exclusion field, use the exclusions below. Request a short cue; select and edit the output to the timing map above.

```text
Instrumental cinematic chamber folk, intimate Scottish coastal atmosphere, 54 BPM with gentle rubato. Fragile solo fiddle, warm bowed cello, airy small string ensemble, natural bow texture, spacious acoustic reverb. A simple rising then falling three-note motif. Breathtaking winter beauty, homesickness as the last boat leaves, solitude, quiet courage. Almost silent opening, melody audible within two seconds, one restrained emotional swell early in the cue, then a steadier cello figure and softer melodic echoes. Tender, human, bittersweet, slightly unresolved; natural fading ending. Short 45-second film cue, no second climax, no vocals or percussion.
```

Exclusions:

```text
vocals, singing, humming, choir, drums, percussion, bagpipes, jig, reel, EDM, trailer music, epic orchestral climax, horror stings, sound effects
```

## Choosing a take

Listen with the real scene. Keep a take whose first phrase arrives during the left turn, whose emotional opening lands on the ocean and gulls, and whose lighthouse return feels quietly purposeful. Reject a take that stays mournful throughout, grows triumphant, implies a monster, or overwhelms the island sounds. The melody should remain recognizable at a modest listening level.

Preserve the full original render and generation settings. Edit a separate 45-second game file with a natural tail. The existing `RevealMusic.js` supports a 2.5-second entrance and four-second exit through the game's master volume and mute; avoid unnecessarily doubling those fades in the asset. The isolated `island-reveal.html` route uses a separate save slot and is the first place to audition a selected cue.

Suno's official [Custom-mode instructions](https://help.suno.com/en/articles/3197377) document the Instrumental toggle and Styles entry. For a generator with explicit timed sections, ElevenLabs' [composition-plan documentation](https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans) describes chunk durations; a matching 45-second plan is saved at `tools/audio/hilltop-cue/composition-plan.json`. The user supplied the selected Suno render after requesting a less uplifting cue and an unsettled ending; the ElevenLabs plan was not rendered.
