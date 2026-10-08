# Climb, apparatus, light and sound refinement

Local review: `artifacts/climb-apparatus/index.html`. The keeper study is available at `http://127.0.0.1:5189/?keeperPreview` while the development server is running. Its save remains separate from the normal watch.

The cast stair now has inner attachment collars, outer wall cleats, baluster shoes and cradles under the timber handrail. The rail meets the landing at its proper height and continues around it. Hatch treads carry fastening detail, the rail heads meet the hatch guards, and iron edging and girder flanges sit beside the opening. These are visual fittings; the existing movement controller, stair surfaces, colliders and interaction targets are retained.

The winding cabinet has a service-door seam, hinges, washer-and-hex fasteners and a clearer crank hub and timber grip. The fixed burner has an oil feed, adjustment wheel and nested wick cups. Its visible flame follows `Lamp.glow` independently of the rotating optic. The main lamp’s local light also follows burner state, including daylight, at a reduced intensity. The glass profile gives each prism separate sloping and return faces; the glass shader balances transmissive views of the burner against brighter prism edges and grazing reflections. Brass bands and rib fasteners clarify its structure.

In the existing teaching weightway, the raised weight now stays below the upper landing slab. It can be seen from the upper treads without looking through that floor. Its stacked plates have end caps and fastening nuts. The existing winding state still controls its height and cable take-up; there is no save migration.

Oil-lamp cones follow their visible sources at the desk, table, entrance and kitchen. Lower spill and room bounds keep their pools local. The carried lamp has a shorter reach and softer intensity. Cool stair-window spill now uses the actual four window positions, while room-window spill remains distinct from warm lamp light. Interior ambient contribution is reduced. Existing sun shadows and automatic exposure remain in use; the matching review captures cover daylight, dusk and night. The unlit night stair remains deliberately dependent on the carried lantern.

Audio retains the existing recordings, clock ticks, escapement, winding ratchet, burner and warning bell. Clock and machinery have separate dry buses and bounded, low-pass early reflections without feedback. Clock audibility falls up the shaft, machinery audibility rises toward the lantern, and the hatch softens its high frequencies. Shelter blends through the hatch and gallery threshold. The gallery door admits wind when opened; the walkway loses the stone reflection. The burner remains attached to its location, and the glazing whistle is positioned at the gallery side.

## Validation

- `npm run build` passed. Vite retains the existing informational warning about `LocalLights.js` being both statically and dynamically imported.
- `npm test` passed: story and intro flow, first watch, keeper duties, unpacking, archive access, station geometry, terrain seams, stair movement, the full walking route, complete story continuity, guidance, engine smoke and mobile input. Stair ascent/descent is checked at 30, 60 and 120 FPS, including settling and jumps.
- `npm run test:station-atmosphere` passed: continuous hatch/gallery shelter, door-dependent exposure, clock and machinery distance profiles, authored lamp cones and flicker, room-mask reset, burner-controlled daylight illumination, fixed flame extinction, and reflection graph routing without a feedback loop.
- After moving the raised weight, `node test/keeper-duties.mjs` and `node test/demo-story.mjs` passed again, including winding while running, real stair reach, legacy watches and isolated saves. The keeper test also checks clearance below the upper landing slab.
- Headless WebGPU review: 15 matching before/after views (five cameras at three times), plus working-burner, winding-cabinet, hatch, carried-lamp and weight close-ups. Source cameras are saved in `artifacts/climb-apparatus/duties/poses.json`.
- The in-app browser automation timed out during the final comparison-page check. The captured scene images were inspected locally; live browser layout and listening acceptance are not claimed.

Reproduce matching views with:

```
node tools/shots/shots.mjs --views=dRoom,dStair,dLantern,dOptic,dDeck --times=12.4,15.3,19 --params=setting=flannan --adapt --w=800 --h=450 --frames=16 --out=artifacts/climb-apparatus/after --tag=after --cols=5
node tools/shots/station-atmosphere.mjs
```

Fitting dimensions, burner appearance and the exposed weightway are modelling reconstructions, not newly established historical specifications. The engine approximates glass with blended reflection/transparency; it does not solve the original optic’s refraction. Local room masks contain spill but do not add local shadow maps. Audio routing/state tests and render captures do not establish physical-speaker, mobile or headset acceptance; a listening pass on the user’s speakers or headphones remains manual.
