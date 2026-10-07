# Seven Hunters on mobile

The selected Option B is now the touch interface for the first-night game.
Phones, iPads (including desktop-site mode) and touch devices without a mouse
select it automatically. `?mobile`
forces the same controls on desktop for review; `?mobile=0` keeps mouse input.
The Tidewater game and the separate `?vr` preview retain their own controls.

## Play and controls

Landscape is recommended; portrait remains usable for reading and playing.

- Start a drag on the left to place the walking stick beneath your thumb. The
  stick has a dead zone and analogue walking speed, and disappears on release.
- Drag the right side to look. Two separate fingers can move and look together.
- A nearby object supplies the action button's label. Hold that button to light
  the lamp or wind the mechanism; the border shows the real interaction progress.
- Tools holds Lamp, Scope, Papers, Hurry and Jump. Lamp and Scope become usable
  when collected. Scope is a toggle so the right thumb remains free to aim.
- On the boat, **Read papers** opens the packet directly. **Go to landing** skips
  the approach, then changes to **Step ashore** to leave the boat. You can also
  wait for the crossing to finish naturally. Reading pauses the approach.
- Cream-and-brass buttons use large period lettering and explicit action labels.
  **Pause** is labelled at the top right; Lantern and Telescope are named in Tools.
  Controls suppress text selection and activate on touch release, including while
  another finger is walking or looking. Cancelled drags cannot activate a button.
- At the signal lamp, the action leaves the exchange. **Read on** sits beside it to
  accelerate signals; replies remain tappable options in the code book.
- The top-right pause button stops the story, offers sound and graphics settings,
  and explains the controls. App blur/backgrounding clears input and pauses the
  mobile watch. Return to the watch resumes; a user tap can also resume audio.

Tap **Experiences** at the top left or in the pause menu to switch story studies,
chapter starts, island exploration and weather previews. Links stay on the current
LAN origin and retain touch controls. The menu scrolls in portrait and landscape;
held movement/actions are cleared while it is open. Minigun practice and extreme
sea events require desktop controls. Tidewater and the water comparison retain
their original controls.

Reading pages scroll independently of movement. Safe-area spacing accounts for
phone screen cutouts and home indicators. Controls hide while papers, cards or
other story pages are open.

Double taps do not zoom the game, including the loader, start screen, pause menu
and spaces between controls. Movement and look gestures stay on the game surface;
papers, help and settings scroll within their own panels without moving the page.
Pinch zoom remains available on reading and menu surfaces. Game controls suppress
accidental text selection and long-press callouts; paper text remains selectable.
Mobile settings inputs use at least 16px text to avoid focus zoom, and rotation
keeps text sizing stable. These gesture policies still need physical phone checks.
Paper height includes its padding so landscape pages fit within the screen and
their bottom buttons remain reachable by scrolling.

## Run on a phone on the same Wi-Fi

Double-click `start-mobile.bat`, or run `node tools/mobile/serve.mjs` from the
project folder. The launcher prints desktop and LAN HTTPS links, uses a free
port starting at 5444 and preserves existing servers. Node dependencies and
PowerShell 7 are required, as with the existing VR launcher.

Open the printed **Phone on the same Wi-Fi** URL on your device. A plain HTTP
LAN address will not provide the secure context WebGPU needs. The local HTTPS
certificate is self-signed; the launcher reuses `.local/xr/` certificate tooling
and never changes the Windows or phone trust stores.

For iPhone/iPad local testing, the public certificate can be downloaded at the
printed HTTPS origin's `/mobile-certificate.cer` address, or transferred from
`.local/xr/certificate.cer`. Install the public certificate profile through iOS
Settings and enable its trust in Certificate Trust Settings if required. The
device owner must choose whether to trust the local certificate and handle any
browser security warning. Never transfer `key.pem`. Android's certificate setup
depends on the device/browser. Windows may require allowing Node on the private
network; certificate, firewall and physical-device setup are not automated.

The HTTPS public site will use its normal certificate after a future deployment.
These changes have not been published. Preview browser checks use
`?mobile&arrivalPreview`, which has a separate save from the normal first night.
Normal mobile play keeps the current save format. Saves belong to their browser,
device and origin; the local HTTPS origin does not share the desktop HTTP save.

## Graphics and verification

Mobile starts at 70% internal render resolution, 1024px shadow maps and a smaller
ocean grid. It retains the sky, cloud cover, fog, beam, station and story, while
omitting the shore simulation, detailed cliff surf, separate water refraction
pass and wake/hull-mask texture bindings. Graphics settings still allow render
scale changes; URL scale/grid overrides are respected.

`node test/mobile-input.mjs` verifies mobile selection, analogue stick motion,
virtual key press/hold/tap behaviour, real winding and object interaction,
boat/signal routing, input cancellation and desktop mouse preservation.
It also checks story command guards and that pausing freezes the watch.
`WEBGPU_DEFAULT_LIMITS=1 node test/mobile-render.mjs` (set the environment variable
appropriately in PowerShell) renders the approach, workroom, lantern, crossing
and night beam at a conservative 16-texture GPU limit.

`npm test` also covers existing game logic, station geometry, walking/stairs/doors,
the full first-night story/save flow, guidance and GPU smoke rendering. Browser
review checks the live touch UI at landscape and portrait phone dimensions.
These checks do not establish physical multi-touch, phone WebGPU availability,
speaker/audio behaviour, sustained frame rate, thermal performance, or phone
certificate/firewall setup. Those require real iPhone and Android playtests.
