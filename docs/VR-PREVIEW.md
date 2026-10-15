# Seven Hunters: Quest 3 preview

The `?vr` route explores the existing Eilean Mòr environment. Opening the normal URL in Meta Quest Browser, or with an available immersive headset, now selects this preview before loading the normal game. **Enter VR** still needs a click because immersive sessions require user activation. Desktop and phone browsers keep their usual first-night flow. Explicit study/preview links keep their selected experience; `?desktop` opens the normal game in the headset’s browser window. The VR preview does not read or write a night save.

Public preview: [Seven Hunters VR](https://thehillbeyondthisone.github.io/seven-hunters/?vr). The public site uses trusted HTTPS and does not need the local server’s certificate setup.

## Run locally

Double-click `start-vr.bat`, or run `npm run dev:vr`. Node.js, the project's npm dependencies, and PowerShell 7 (`pwsh`) are required; they are already available on this development machine. The server starts at port 5443, choosing another free port if needed, and prints desktop and LAN URLs. It leaves existing servers running.

Open the printed LAN URL ending in `/?vr` in Meta Quest Browser while the headset and PC are on the same network. Choose a start location and resolution, then press **Enter VR**. Start at **Balanced (65%)** with **Smooth edges (4×)**. If motion is uneven, compare **Off · more performance**, then **Low (50%)**. A Windows firewall prompt may require allowing Node on your private network.

The local HTTPS certificate is self-signed and includes the machine's current IPv4 addresses. Files live in the ignored `.local/xr/` directory. The launcher does not install certificates in Windows or change certificate trust. A browser may ask you to accept or trust this certificate before WebXR is usable; the preview reports whether the page is a secure context. The public certificate is available at `/xr-preview-certificate.cer` if it needs to be installed on a test device. Private key routes are blocked by the dev server. When a certificate expires or the PC's addresses change, the next launch regenerates it.

The preview requires WebGPU for its scene renderer and immersive WebXR for headset tracking and presentation. It uses native `XRGPUBinding` when available. Meta introduced this experimentally in [Browser 146.0](https://developers.meta.com/vr/downloads/package/browser/146.0/); its absence does not establish that a browser is outdated.

When native WebGPU-in-WebXR is unavailable, the preview uses the standard `XRWebGLLayer` presentation path: each eye is rendered by the existing WebGPU engine, copied from a staging canvas into a WebGL texture, and presented to the headset. This keeps the same world, materials and controls and avoids requiring the experimental WebGPU XR feature. The additional canvas copy needs physical Quest performance testing; start at Low resolution if Balanced is uneven. Session-request failures stay visible and leave browser-window exploration available.

If the browser rejects a direct WebGPU-canvas upload (including WebGL error 1282), the preview retries that eye through a Canvas2D snapshot and keeps using that transfer route for the session. Uploads bind the preview’s own texture with the XR framebuffer detached; compositor drawing then restores the required graphics bindings and detaches the framebuffer afterward. Only the synchronous headset animation callback can present. The preview relies on WebXR’s required per-frame clear instead of explicitly clearing the opaque framebuffer; each eye viewport is fully overwritten. A remaining error identifies graphics setup, frame start, texture binding/upload or compositor drawing separately. The recovery adds another copy and still requires physical Quest performance testing.

**VR compatibility details** shows the detected headset support, connection security, graphics APIs and browser identification. **Recheck VR** refreshes these checks. If the direct WebGPU session or layer is rejected, **Try compatibility VR** makes a fresh standard-WebXR request from your next click. `?vr&xrBackend=webgl` selects compatibility mode explicitly for comparison. The page no longer suggests updating the browser solely because its experimental WebGPU XR binding is absent.

Desktop preview: open the printed localhost HTTPS URL or `http://127.0.0.1:5189/?vr` with the normal dev server. Select locations, press **Explore on desktop**, and use the normal mouse/WASD controls. **Return to the normal game** opens the first night at the same origin. Browser save storage remains specific to that origin and device; this work does not synchronize saves between PC and Quest.

The compatibility bridge records pending WebGL errors at the start of each headset callback before issuing its own GL commands. These are shown in **Last VR session** after exit, instead of being attributed to a subsequent successful framebuffer operation. New errors from binding, upload, draw and release are still checked and stop the session; a lost context or error queue that will not reset also stops it. This separates errors arriving during the browser handoff from failures in the preview's commands without proving their original cause.

## Quest controls

| Control | Action |
|---|---|
| Head movement | Look and move naturally; no added head bob |
| Left stick | Walk at 1.6 metres/second, relative to your gaze |
| Right stick left/right | Snap turn 30 degrees; release before turning again |
| Right trigger | Point at a nearby station door or gate and open/close it |
| Right A | Cycle approach, yard, keepers' room, stairs, lantern room, east landing |
| Right B | Recenter tracking at the current location |
| Left Y | Exit VR and return to the desktop preview |

Controller rays show where you are pointing. Walking uses the existing station colliders and floors. Small steps are allowed; deep water and large drops are blocked. If floor tracking is unavailable, local tracking uses a 1.62 m initial eye height. Tracking loss/system overlays pause preview updates. Exit restores desktop rendering and clears held inputs.

Release the sticks and buttons after entering VR, returning from a system overlay, or resetting tracking. The preview waits for neutral controls before accepting movement or actions. Doors require a tracked right controller. Stair height changes ease into the view while real head movement and crouching remain immediate.

## Scope and architecture

This milestone is environment exploration, with no story UI, telescope zoom, boat ride, swimming, hand tracking, or teleport locomotion. Clouds, volumetric haze/beams, shore simulation and boat wakes are disabled in the preview. The Quest profile uses two 1024-pixel shadow cascades out to 90 metres, without near-cascade PCSS blocker searches. Ocean geometry is reduced. Water retains FFT swell, filtered normals, shore foam, sky reflection and a broad sun reflection, with analytic distance haze. It requires no opaque scene copies, refraction tracing, screen-space reflection march or boat hull masks. The lighthouse lamp and your carried storm lantern are lit for inspection. Browser-window exploration on the VR route shares these simplified materials; normal desktop graphics are unchanged.

Quest grass retains the original seeded roots, palette and wind movement. Eight-metre patches use 8192 / 2048 / 256 blades at 2 / 1 / 1 segments, versus desktop 40960 / 16384 / 4096 at 3 / 2 / 1 segments. This cuts triangles per patch by 88% / 96% / 94%, with wider blades and shorter individual-blade ranges (6 / 14 / 28 metres). Terrain colour continues into the distance. These are geometry reductions, not measured FPS gains.

Sky irradiance automatically uses fewer compute lanes on adapters with a 16 KiB workgroup-memory limit. The calculation still visits the same sky texels; higher-limit desktop adapters retain the original lane count.

The shared world update runs once per XR frame. Head tracking and controller input own the preview camera and walking capsule. Per-eye headset projections keep their asymmetric frusta, with depth converted into the engine's reversed-depth convention. Each eye uses one forward colour/depth render pass, with tone mapping in the materials and sky. Motion/water-mask attachments, opaque colour/depth copies and the final fullscreen tone-map pass are removed. With edge smoothing enabled, a private 4× multisample colour target resolves into the XR texture or compatibility staging canvas. With smoothing off, rendering writes directly into that destination. Depth stays private; no reversed-depth texture is submitted to the compositor. Array layers and atlas viewports are both supported.

Native session, adapter and layer setup follow the [WebXR/WebGPU binding specification](https://immersive-web.github.io/webxr-webgpu-binding/). That path requires the `webgpu` session feature and an XR-compatible WebGPU adapter. The compatibility path requests an ordinary immersive session and an XR-compatible WebGL context for presentation, while the engine continues to render with WebGPU. The different WebGL and WebGPU projection-depth conventions are converted before scene rendering.

Simulation/shadows and each eye submit separately. This intentionally avoids overwriting shared GPU camera/material buffers before both eyes have drawn. Multiview and eliminating the compatibility transfer remain further work; this pass does not enable compositor foveation. Desktop temporal upscaling, AO, motion blur, bloom and lens effects are bypassed in immersive mode. Forward material pipelines warm before immersive callbacks begin, including currently hidden scene meshes.

Expand **Performance comparison** to switch between the improved preview and the previous VR graphics at the selected resolution, or test without grass. `?vr&xrLegacy` restores the previous HDR rendering, water, grass and shadow profile for comparison; its edge-smoothing control is disabled. `?vr&grass=desktop` uses the original grass density with the new forward renderer. `?vr&xrSamples=1` starts with smoothing off. These options do not change a saved night.

The preview code is under `src/xr/` and loaded on demand. The normal game retains its existing input, camera, story and save flow. Continue authoring locations, materials and game systems once for both modes; new UI and interactions will need appropriate desktop and VR presentations.

## Verification and next device check

`npm run test:xr` checks headset detection before story/mobile setup, explicit-route and browser-window overrides, both projection/depth conventions, native and compatibility session lifecycle, controller mapping, movement, collision, snap-turn pivot, stair smoothing, immediate crouching, neutral controls on resume, floor fallback, reference-space resets, async entry cancellation, failed sessions, session cleanup, repeated entry, viewport restoration, distinct eye images, array layers and atlas viewports. Rendering checks exercise 1× and 4× sampling, sRGB and ordinary targets, and reject use of the desktop scene-copy renderer. `node test/flannan-sward.mjs` verifies Quest geometry budgets and preserved seeded roots. `npm run test:xr-scene` checks all six real VR spawn positions and renders those locations plus night views of the room and lantern with synthetic XR views and controller rays. Set `WEBGPU_DEFAULT_LIMITS=1` for conservative mobile binding limits and `XR_TEST_OUT=artifacts/vr-performance/forward` to preserve earlier previews. `XR_TEST_QUERY` overrides the test URL options; `XR_TEST_VIEWS=fApproach,dLanding` restricts image captures while retaining all spawn checks. With the HTTPS server running, `node test/xr-launch.mjs` checks its page, certificate and private-file exclusions (`XR_PORT` overrides port 5443). `npm test` covers the existing game logic, Flannan geometry, walk route, first-night story, guidance and engine smoke test.

`test/xr-bridge-browser.html` exercises real WebGPU and WebGL contexts with a simulated compositor framebuffer. It checks two distinct eye images, quadrant colors, vertical orientation and graphics errors in one callback. It proves the browser canvas-transfer mechanism, while physical headset behavior and sustained performance remain separate acceptance checks.

Local browser screenshots and synthetic stereo renders are in `artifacts/xr-preview/`. These checks verify code and local GPU rendering. They do not measure Quest startup, sustained frame rate, headset comfort, physical controller input, audio or certificate/firewall setup.

For an automated launcher check that starts and stops its own isolated server, run `node test/xr-launch.mjs --spawn`. It uses port 5543 or the next available port, leaving any existing preview running.

On Quest, first inspect the approach and coast, then the room and stairs, then the lantern. Check world scale, left/right alignment, leaning, 30-degree turns, door selection, and exit/re-entry. After exit, expand **Last VR session** for the backend and transfer route, sample count, grass triangles per eye, 95th percentile XR callback interval and CPU submission time over the last 512 rendered frames, long intervals (over 1.5 frame periods), and tracking/overlay pauses. Eye encoding and compatibility-upload CPU calls are reported separately. They are not GPU timings.

When WebGPU exposes timestamp queries, the new renderer also samples the two eye render passes asynchronously once per 30 frames, keeping at most 128 distinct samples. GPU eye timing excludes shared simulation, shadows and compatibility-transfer GPU work. Unavailable or unfinished timings say **not measured**; a new session clears prior samples. No frame callback waits for GPU readback. `window.__xr.stats` remains available in remote DevTools; `window.__xr.lastReport` holds the completed summary. None of these measurements alone establishes sustained headset FPS or comfort. Save the installed browser version, backend, transfer route, resolution and smoothing setting with observations.

## Quest 3 device acceptance pass

The local automated pass can run with the headset disconnected. The following checks remain physical-device acceptance:

1. Open the printed LAN HTTPS URL on Quest 3. Confirm the page reports VR available. Record the Quest Browser version, resolution and whether certificate trust needed setup.
2. Enter at Balanced resolution, release all controls, and stay on the approach for two minutes. Turn, lean and crouch: scale and stereo alignment should remain stable, with no extra head bob.
3. Walk the yard, point at doors and gates, and use the right trigger. Check collisions with shut doors, passage through open doors, stair ascent/descent, and blocking of cliff drops and deep water.
4. Use A to visit all six locations. Check floors, near surfaces, controller rays, sea rendering and the carried lamp. Listen outdoors, indoors and in the lantern room for spatial sound.
5. Open the Quest system menu while holding a stick, then resume. Movement should wait for release. Repeat after briefly removing the headset. Use B to recenter; position should stay put.
6. Exit with left Y, inspect **Last VR session**, change resolution and re-enter. Repeat three times. The desktop page should remain usable and held controls should not carry over.
7. Spend at least ten minutes walking between the room, stairs, lantern and coast. Record sustained stutter, visual defects and discomfort separately from the timing summary. Compare the previous VR graphics at the same location and resolution. If Balanced is uneven, compare smoothing off, then Low resolution. Use the no-grass comparison to identify geometry cost; record the transfer route to identify compatibility-copy cost.

This pass covers the existing environment exploration mode. Story dialogue, papers, boat arrival, telescope and keeper duties still need VR interfaces before the saved watch can be played in the headset.
