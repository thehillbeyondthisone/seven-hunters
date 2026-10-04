# Seven Hunters: Quest 3 preview

The opt-in `?vr` route explores the existing Eilean Mòr environment. The normal URL continues to launch the desktop first-night game. The preview does not read or write a night save.

## Run locally

Double-click `start-vr.bat`, or run `npm run dev:vr`. Node.js, the project's npm dependencies, and PowerShell 7 (`pwsh`) are required; they are already available on this development machine. The server starts at port 5443, choosing another free port if needed, and prints desktop and LAN URLs. It leaves existing servers running.

Open the printed LAN URL ending in `/?vr` in Meta Quest Browser while the headset and PC are on the same network. Choose a start location and resolution, then press **Enter VR**. Start at **Balanced (65%)**, or **Low (50%)** if motion is uneven. A Windows firewall prompt may require allowing Node on your private network.

The local HTTPS certificate is self-signed and includes the machine's current IPv4 addresses. Files live in the ignored `.local/xr/` directory. The launcher does not install certificates in Windows or change certificate trust. A browser may ask you to accept or trust this certificate before WebXR is usable; the preview reports whether the page is a secure context. The public certificate is available at `/xr-preview-certificate.cer` if it needs to be installed on a test device. Private key routes are blocked by the dev server. When a certificate expires or the PC's addresses change, the next launch regenerates it.

Quest Browser must expose both immersive WebXR and `XRGPUBinding` (WebGPU rendering in WebXR). Meta introduced this experimentally in [Browser 146.0](https://developers.meta.com/vr/downloads/package/browser/146.0/). If the entry button reports unavailable WebGPU-in-WebXR support, update the headset browser and check its WebXR/WebGPU experimental settings. Basic WebGPU support alone is insufficient. A session-request failure remains visible on the page and leaves desktop exploration available.

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

## Scope and architecture

This first milestone is environment exploration, with no story UI, telescope zoom, boat ride, swimming, hand tracking, or teleport locomotion. Clouds, volumetric haze/beams, shore simulation and boat wakes are disabled in the preview; shadow maps and ocean geometry are reduced. Water uses the opaque scene copy rather than a separate underwater refraction pass, and omits boat hull masks, to fit mobile texture limits. The lighthouse lamp and your carried storm lantern are lit for inspection. Desktop VR-preview graphics are also simplified; normal desktop graphics are unchanged.

Sky irradiance automatically uses fewer compute lanes on adapters with a 16 KiB workgroup-memory limit. The calculation still visits the same sky texels; higher-limit desktop adapters retain the original lane count.

The shared world update runs once per XR frame. Head tracking and controller input own the preview camera and walking capsule. Per-eye headset projections keep their asymmetric frusta, with depth converted into the engine's reversed-depth convention. The scene and water render into private HDR/depth targets, then a simple tone-map pass presents each view to its XR projection layer. No reversed-depth texture is submitted to the compositor.

Session, adapter and layer setup follow the [WebXR/WebGPU binding specification](https://immersive-web.github.io/webxr-webgpu-binding/). The preview requires the `webgpu` session feature and an XR-compatible WebGPU adapter.

The initial implementation submits simulation/shadows and each eye separately. This intentionally avoids overwriting shared GPU camera/material buffers before both eyes have drawn. Eye-specific render targets and uniform buffers, multiview, and a broader Quest quality profile can follow after physical-device profiling. Desktop temporal upscaling, AO, motion blur, bloom and lens effects are bypassed in immersive mode.

The preview code is under `src/xr/` and loaded on demand. The normal game retains its existing input, camera, story and save flow. Continue authoring locations, materials and game systems once for both modes; new UI and interactions will need appropriate desktop and VR presentations.

## Verification and next device check

`npm run test:xr` checks projection/depth math, controller mapping, movement, collision, snap-turn pivot, floor fallback, recentering, session cleanup, distinct eye images, array layers and atlas viewports. `npm run test:xr-scene` renders the actual station/coast with synthetic XR views. Set `WEBGPU_DEFAULT_LIMITS=1` for conservative mobile binding limits. `npm test` covers the existing game logic, Flannan geometry, walk route, first-night story, guidance and engine smoke test.

Local browser screenshots and synthetic stereo renders are in `artifacts/xr-preview/`. These checks verify code and local GPU rendering. They do not measure Quest startup, sustained frame rate, headset comfort, physical controller input, audio or certificate/firewall setup.

On Quest, first inspect the approach and coast, then the room and stairs, then the lantern. Check world scale, left/right alignment, leaning, 30-degree turns, door selection, and exit/re-entry. Use `window.__xr.stats` in remote DevTools for XR frame interval and CPU timing; those values are not GPU timings. Save the installed browser version and selected resolution with any performance observations.
