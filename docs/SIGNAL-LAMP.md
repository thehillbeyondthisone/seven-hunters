# Examine the signal lamp

Any time it is not dark (the renderer's `G.night` below 0.5), the walkway's signal lamp offers
**Examine the signal lamp**. Walk out of the gallery door and look at the lamp. The keeper-duty
study (`keeper-duties.html`, `?keeperPreview`) starts before sunset and is the quickest route to it.
At night the lamp returns to its story job, signalling Gallan Head. If Cate is calling or talking
by day, the signal item keeps priority.

Examining holds the walker, frees the mouse and frames the lamp beside the lesson. The balcony rail
is temporarily hidden as a labelled study cutaway; stepping away restores its visibility. Its collision
remains intact. On narrow screens, the lamp sits above a scrollable lesson panel.

**Explore** brings the individual parts closer. **Light it** suggests one physical action at a time,
including waiting for the low flame to warm. **Send a letter** offers E, T and A, shows your flashes and
reads them back with gentle retry feedback. All contextual operations remain in **All lamp controls**.
Hold Space or **Hold to flash** to work the shutter. Esc or **Step away** returns you to the walker.
**Read the field guide** opens one reader with four short chapters, including history, reconstruction
notes and sources. Closing it returns to the study with a free cursor.

For direct review, open `?signalLampPreview`. It starts a fresh daylight lamp study and uses
`sevenhunters.signal-lamp-preview.v1`, separate from normal watches. The main title has its own
establishing camera even when an existing watch awaits the Continue choice.

## A working lamp on the story clock

`src/story/SignalLampStudy.js` keeps `flags.signalLamp` (saved with the watch) and advances it
with the story clock, whether or not you are at the lamp. A lamp left burning burns until its fount is dry.

- **Lighting**: open the side door, lift the glass chimney, have the wick above the burner slot
  and oil in the fount, then strike a match. Seat the glass and shut the door afterwards.
- **Warming and smoking**: the clear-burning limit rises with the lamp's heat and its draught. The
  chimney drawn up, the glass seated and the door shut give the best draught. A wick turned up past
  the limit smokes, and the smoke clouds the glass, which dims the beam until it is cleaned. Turning up by
  stages as the lamp warms gives a full, clear flame.
- **Burning**: a full fount lasts ten hours at a full flame. The wick chars as it burns, and a charred wick
  dims the beam until it is trimmed.
- **Servicing**: fill, trim and clean only with the lamp out and cool. Turning the wick right
  down puts the flame out.
- **Signalling**: the key opens the vanes only while held, and the spring closes them. The beam
  (`app.signalLight`, the lens glow) shows only when lit and open. Your flashes are read back as
  Morse with the 1889 proportions: a dash is three dots, with one unit between the parts of a
  letter, three between letters and six between words. The reading adapts to your speed. The
  first flash in daylight states the actual distance to Gallan Head against the recorded range.

Nothing is scored or timed, and there are no invented faults: the lamp starts clean, filled and
trimmed, with the chimney pushed down as for packing.

## Model

`tools/props/signal-lamp.blend` holds the Begbie lamp, with a hollow body, a side door, a fount,
burner, flat wick, flame, glass chimney, rear reflector, six shutter vanes, key, telescoping chimney,
sights, tripod and kerosene can. Objects with a `part` and `pivot` property are moving parts. Its
`export_signal_lamp` text block writes `src/world/flannan/SignalLampModel.js` (`static` by finish,
`parts` relative to their pivots). `Station.js` bakes the static geometry; `assembleStation`
builds the parts as `moving.signalLamp`. The lens and glass chimney use the lantern glass; the
flame and the lens glow use their own burner-flame materials.

## Evidence and reconstruction

| Claim or design | Evidence / boundary |
| --- | --- |
| Lamp "B" (Begbie), glass chimneys, wick, kerosene, shared lamp/heliograph stands | [Regulations for the Equipment of the Regular Army, 1893](https://archive.org/details/regsequipmentreguarmy1893), equipment tables. |
| Six-inch bullseye; flat wick in a circular burner; kerosene; fount of ten hours; spare oil and chimneys in the box; noisy shutter heard up to 600 yards; lamp in box about 35 lb; range up to 10 miles in England | [Active Service Pocket Book, 1915](https://archive.org/details/activeservicepocketbook1915), "Begbie Lamp". Later than 1901 for the same pattern. The fount's capacity is illegible in the scan. |
| Read at 4–8 miles (helio 10–15) | A 1910 military text on Internet Archive (`in.ernet.dli.2015.279106`). |
| Dot, dash = three dots, 1/3/6 unit intervals; shutter apparatus principle | [Edye & Rhodes, Catechism on the Manual of Instruction in Army Signalling, 1889](https://archive.org/details/catechismonmanua00edyerich). Its hand lamp burned colza oil ("no mineral oil") with a flat wick edge-on to the bullseye. The Begbie's kerosene comes from the 1893 and 1915 sources. |
| Black steel box about 38 cm, knob-operated shutters, convex lens | [Collections WA](https://collectionswa.net.au/items/4cc23cb3-5ea2-46f7-8b9e-e66ccfb941ae); [Soldiers of Oxfordshire Museum](https://www.sofo.org.uk/exhibits/begbie-oil-signal-lamp/). |
| Noisy and conspicuous in 1914; replaced by electric lamps in 1915 | [Priestley, The Signal Service in the European War, 1921](https://archive.org/details/signalserviceine00prie). |
| Six vanes, side door, rear reflector, chimney travel (4.5 cm), glass lift, warm-up (about 5 game minutes), smoking threshold, soot and char rates | Authored reconstruction. Surviving photographs do not show these internals clearly. |
| A Begbie lamp at the Flannan station | **Not documented.** It is the period-correct portable shuttered lamp, not a recorded fitting. Gallan Head is about 20 miles off, beyond the recorded ranges. The night exchange with Cate is story fiction, and the study says so in daylight. |

## Checks

`node test/signal-lamp.mjs` covers the model and placement, the daylight offer, the full lighting,
warming, smoking, flashing, Morse reading, burning, extinguishing and servicing sequence, and saves
and papers. `node tools/shots/signal-lamp.mjs` renders eight native-WebGPU views of the lamp
states to `artifacts/signal-lamp/` (set `VK_ICD_FILENAMES` as in HISTORY.md without a GPU).
