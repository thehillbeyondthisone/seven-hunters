# The Black Atlantic

An isolated atmosphere study for the west landing. Open `http://127.0.0.1:5189/sea-dread.html` while the normal development server is running, or double-click `start-sea-dread.bat`. The launcher starts the usual server only if its port is available; it never stops an existing listener.

The preview starts at authored winter dusk, facing the Atlantic from a supported landing step. It uses the existing ocean, weather and cliff-surf systems. No new fluid solver is included, and this is not a reconstruction of historical weather. The route forces `nostory` and does not open or write a keeper's save.

The presentation adds a low marine mist layer, a cold overcast grade, darker indirect light, less prominent particle spray and nearby rain, a distant lightning silhouette with a single broad light pulse, and delayed synthesized thunder. Nearby cliff-impact events produce a brief, distance-attenuated camera tremor and a low rumble. The existing cliff events remain analytically timed; this pass does not turn them into physically solved wave collisions.

Camera shake modifies the rendered orientation only, peaks below half a degree, and restores the original orientation afterward. It never moves the player or changes collision support. Headset cameras receive no shake. This preview is disabled on the VR route.

Use **Sea dread** to compare with the same underlying weather and time. **Reduced effects** disables camera shake and lightning flashes while retaining the mist and sound; the system's reduced-motion preference selects it on first load. **Distant lightning** previews a storm reveal. **Face the Atlantic**, **West landing**, **Station yard** and **Inside** switch locations. Collapse the control panel for an unobstructed view. M mutes the shared audio mixer, including the new sounds.

Automatic lightning is spaced by 32–58 seconds after the first reveal. Thunder follows the source-distance delay; going indoors attenuates it. Sound uses the existing mixer and limiter, has bounded simultaneous voices, and cleans up its audio nodes when each event ends. It still needs a human listening pass for perceived balance and bass on actual speakers/headphones.

Validation commands:

```powershell
node test/sea-dread.mjs
node test/sea-weather.mjs
npm test
npm run build
node tools/shots/sea-dread.mjs
```

The focused tests cover route/save isolation, delayed thunder, reduced effects, cancellation, bounded shake, camera restoration and lightning geometry. The scene review writes matched baseline/dread views of the west landing, cliffs and workroom, plus a lightning frame, to `artifacts/sea-dread/`, with strict WebGPU validation. Browser review covers loading, the playable scene, location controls and the two effect switches. These checks do not establish a frightening subjective experience, sustained performance, physical mobile/headset behaviour, or speaker audibility.
