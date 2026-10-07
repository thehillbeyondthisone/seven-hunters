# Unauthorised keeper equipment

The Keeper's Minigun is a deliberately absurd, opt-in desktop dev easter egg. It uses TWORKS's
downloadable Sketchfab minigun model, representing a real type of rotary machine gun. The model
guided the spin-up, rotating barrel cluster, continuous fire, muzzle flash, brass ejection and tracers.
The model is credited under CC BY 4.0 in `public/models/dev-weapons/CREDITS.md`.

Run `start.bat`, then open **http://127.0.0.1:5189/?devWeapons&devTargets** for island exploration
with the weapon equipped and seven practice buoys. This route opens no story or saved watch.

During an ordinary desktop session, **backtick (`)** opens the simulation debug menu, where
**Equip minigun** and **Summon practice buoys** make the equipment discoverable. **F8** also loads/equips the gun, then toggles holster/equip.
It does not enter the inventory or save data. Normal story interactions still use E. It hides and
stops firing while reading, paused, aboard the opening boat, using the signal lamp/telescope, or
in photo mode. Mobile/immersive XR weapon controls are not implemented.

| Input | Action |
|---|---|
| Hold left mouse button, with the mouse captured | Spin up, then fire |
| Hold X | Keyboard alternative for firing |
| G | Summon/reset seven striped practice buoys in front of you |
| F8 | Holster/equip |

The gun has infinite ammo and visible recoil. Hits knock the buoys up and away; gravity, bounce,
ground friction and station collision move them afterwards. Tracers stop at existing collision
boxes, tower walls (respecting door gaps), terrain or the sea. Stone/ground sparks and water impact
particles are temporary. The building, furnishings, wildlife and story state receive no damage.
Effects use fixed pools, and G replaces the existing buoys. Holstering stops the motor and firing sound;
M and the game's volume control also affect the synthetic gun sound.

With a tsunami or blast active, submerged practice buoys float and are pushed by the coastal
solver's currents. The debug menu blocks weapon firing. See [Simulation room](SIMULATION-ROOM.md).

Use `npm run test:dev-weapons` for firing, blocking, target physics, import checks and the native
WebGPU model/effects render. Physical speaker
audibility and sustained gameplay performance remain playtest checks.
