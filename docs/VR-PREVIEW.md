# Seven Hunters: Quest 3 preview

The `?vr` route explores the existing Eilean Mòr environment. Opening the normal URL in Meta Quest Browser, or with an available immersive headset, now selects this preview before loading the normal game. **Enter VR** still needs a click because immersive sessions require user activation. Desktop and phone browsers keep their usual first-night flow. Explicit study/preview links keep their selected experience; `?desktop` opens the normal game in the headset’s browser window. The VR preview does not read or write a night save.

Public preview: [Seven Hunters VR](https://thehillbeyondthisone.github.io/seven-hunters/?vr). The public site uses trusted HTTPS and does not need the local server’s certificate setup.

## Run locally

Double-click `start-vr.bat`, or run `npm run dev:vr`. Node.js, the project's npm dependencies, and PowerShell 7 (`pwsh`) are required; they are already available on this development machine. The server starts at port 5443, choosing another free port if needed, and prints desktop and LAN URLs. It leaves existing servers running.

Open the printed LAN URL ending in `/?vr` in Meta Quest Browser while the headset and PC are on the same network. Choose a start location and resolution, then press **Enter VR**. Start at **Balanced (65%)**, or **Low (50%)** if motion is uneven. A Windows firewall prompt may require allowing Node on your private network.

The local HTTPS certificate is self-signed and includes the machine's current IPv4 addresses. Files live in the ignored `.local/xr/` directory. The launcher does not install certificates in Windows or change certificate trust. A browser may ask you to accept or trust this certificate before WebXR is usable; the preview reports whether the page is a secure context. The public certificate is available at `/xr-preview-certificate.cer` if it needs to be installed on a test device. Private key routes are blocked by the dev server. When a certificate expires or the PC's addresses change, the next launch regenerates it.

The preview requires WebGPU for its scene renderer and immersive WebXR for headset tracking and presentation. It uses native `XRGPUBinding` when available. Meta introduced this experimentally in [Browser 146.0](https://developers.meta.com/vr/downloads/package/browser/146.0/); its absence does not establish that a browser is outdated.

When native WebGPU-in-WebXR is unavailable, the preview uses the standard `XRWebGLLayer` presentation path: each eye is rendered by the existing WebGPU engine, copied from a staging canvas into a WebGL texture, and presented to the headset. This keeps the same world, materials and controls and avoids requiring the experimental WebGPU XR feature. The additional canvas copy needs physical Quest performance testing; start at Low resolution if Balanced is uneven. Session-request failures stay visible and leave browser-window exploration available.

**VR compatibility details** shows the detected headset support, connection security, graphics APIs and browser identification. **Recheck VR** refreshes these checks. If the direct WebGPU session or layer is rejected, **Try compatibility VR** makes a fresh standard-WebXR request from your next click. `?vr&xrBackend=webgl` selects compatibility mode explicitly for comparison. The page no longer suggests updating the browser solely because its experimental WebGPU XR binding is absent.

Desktop preview: open the printed localhost HTTPS URL or `http://127.0.0.1:5189/?vr` with the normal dev server. Select locations, press **Explore on desktop**, and use the normal mouse/WASD controls. **Return to the normal game** opens the first night at the same origin. Browser save storage remains specific to that origin and device; this work does not synchronize saves between PC and Quest.

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

This first milestone is environment exploration, with no story UI, telescope zoom, boat ride, swimming, hand tracking, or teleport locomotion. Clouds, volumetric haze/beams, shore simulation and boat wakes are disabled in the preview; shadow maps and ocean geometry are reduced. Water uses the opaque scene copy rather than a separate underwater refraction pass, and omits boat hull masks, to fit mobile texture limits. The lighthouse lamp and your carried storm lantern are lit for inspection. Desktop VR-preview graphics are also simplified; normal desktop graphics are unchanged.

Sky irradiance automatically uses fewer compute lanes on adapters with a 16 KiB workgroup-memory limit. The calculation still visits the same sky texels; higher-limit desktop adapters retain the original lane count.

The shared world update runs once per XR frame. Head tracking and controller input own the preview camera and walking capsule. Per-eye headset projections keep their asymmetric frusta, with depth converted into the engine's reversed-depth convention. The scene and water render into private HDR/depth targets, then a simple tone-map pass presents each view to its XR projection layer. No reversed-depth texture is submitted to the compositor.

Native session, adapter and layer setup follow the [WebXR/WebGPU binding specification](https://immersive-web.github.io/webxr-webgpu-binding/). That path requires the `webgpu` session feature and an XR-compatible WebGPU adapter. The compatibility path requests an ordinary immersive session and an XR-compatible WebGL context for presentation, while the engine continues to render with WebGPU. The different WebGL and WebGPU projection-depth conventions are converted before scene rendering.

The initial implementation submits simulation/shadows and each eye separately. This intentionally avoids overwriting shared GPU camera/material buffers before both eyes have drawn. Eye-specific render targets and uniform buffers, multiview, and a broader Quest quality profile can follow after physical-device profiling. Desktop temporal upscaling, AO, motion blur, bloom and lens effects are bypassed in immersive mode.

The preview code is under `src/xr/` and loaded on demand. The normal game retains its existing input, camera, story and save flow. Continue authoring locations, materials and game systems once for both modes; new UI and interactions will need appropriate desktop and VR presentations.

## Verification and next device check

`npm run test:xr` checks headset detection before story/mobile setup, explicit-route and browser-window overrides, both projection/depth conventions, native and compatibility session lifecycle, controller mapping, movement, collision, snap-turn pivot, stair smoothing, immediate crouching, neutral controls on resume, floor fallback, reference-space resets, async entry cancellation, failed sessions, session cleanup, repeated entry, viewport restoration, distinct eye images, array layers and atlas viewports. `npm run test:xr-scene` checks all six real VR spawn positions and renders those locations plus night views of the room and lantern with synthetic XR views and controller rays. Set `WEBGPU_DEFAULT_LIMITS=1` for conservative mobile binding limits, and `XR_TEST_OUT=artifacts/quest-pass` to preserve the earlier previews. With the HTTPS server running, `node test/xr-launch.mjs` checks its page, certificate and private-file exclusions (`XR_PORT` overrides port 5443). `npm test` covers the existing game logic, Flannan geometry, walk route, first-night story, guidance and engine smoke test.

`test/xr-bridge-browser.html` exercises real WebGPU and WebGL contexts with a simulated compositor framebuffer. It checks two distinct eye images, quadrant colors, vertical orientation and graphics errors in one callback. It proves the browser canvas-transfer mechanism, while physical headset behavior and sustained performance remain separate acceptance checks.

Local browser screenshots and synthetic stereo renders are in `artifacts/xr-preview/`. These checks verify code and local GPU rendering. They do not measure Quest startup, sustained frame rate, headset comfort, physical controller input, audio or certificate/firewall setup.

For an automated launcher check that starts and stops its own isolated server, run `node test/xr-launch.mjs --spawn`. It uses port 5543 or the next available port, leaving any existing preview running.

On Quest, first inspect the approach and coast, then the room and stairs, then the lantern. Check world scale, left/right alignment, leaning, 30-degree turns, door selection, and exit/re-entry. After exit, expand **Last VR session** for the 95th percentile XR callback interval and CPU submission time over the last 512 rendered frames, long intervals (over 1.5 frame periods), and tracking/overlay pauses. `window.__xr.stats` remains available in remote DevTools; `window.__xr.lastReport` holds the completed summary. These are not GPU timings or a comfort assessment. Save the installed browser version and selected resolution with any observations.

## Quest 3 device acceptance pass

The local automated pass can run with the headset disconnected. The following checks remain physical-device acceptance:

1. Open the printed LAN HTTPS URL on Quest 3. Confirm the page reports VR available. Record the Quest Browser version, resolution and whether certificate trust needed setup.
2. Enter at Balanced resolution, release all controls, and stay on the approach for two minutes. Turn, lean and crouch: scale and stereo alignment should remain stable, with no extra head bob.
3. Walk the yard, point at doors and gates, and use the right trigger. Check collisions with shut doors, passage through open doors, stair ascent/descent, and blocking of cliff drops and deep water.
4. Use A to visit all six locations. Check floors, near surfaces, controller rays, sea rendering and the carried lamp. Listen outdoors, indoors and in the lantern room for spatial sound.
5. Open the Quest system menu while holding a stick, then resume. Movement should wait for release. Repeat after briefly removing the headset. Use B to recenter; position should stay put.
6. Exit with left Y, inspect **Last VR session**, change resolution and re-enter. Repeat three times. The desktop page should remain usable and held controls should not carry over.
7. Spend at least ten minutes walking between the room, stairs, lantern and coast. Record sustained stutter, visual defects and discomfort separately from the timing summary. If Balanced is uneven, repeat at Low resolution.

This pass covers the existing environment exploration mode. Story dialogue, papers, boat arrival, telescope and keeper duties still need VR interfaces before the saved watch can be played in the headset.
