# The night sky over Eilean Mòr

Discrete stars now come from **8,920 HYG v4.1 catalog entries**, to visual magnitude 6.5. Orion, the Plough, Cassiopeia, the Pleiades and Polaris have measured positions and relative magnitudes rather than generated placements. B−V photometry supplies restrained color where available.

The sky follows the same location, calendar, local clock and optional azimuth rotation as the sun and moon. The first story watch is 3 January 1901 at 58.288° N, 7.588° W. Advancing time rotates the sky at the sidereal rate; crossing midnight advances the catalog orientation continuously. Advancing the story calendar changes the sky for the season. Undated Tidewater uses an illustrative J2000 reference day with its existing solar lighting.

J2000 proper motions are propagated as tangent vectors, then IAU 1976 precession carries coordinates into the mean equator and equinox of the simulated date. The renderer converts world directions into that frame using Greenwich mean sidereal time, longitude and latitude. Proper motions, precession and the lookup index refresh once per UTC day; the orientation matrix follows every clock update. This also places historical Polaris slightly away from the pole.

Twilight, moonlight, low-altitude extinction and clouds suppress faint stars. Point profiles shrink with field of view, so the existing telescope shows pinpoints instead of magnified blobs. The broad Milky Way glow follows the real galactic plane but is an artistic band, not a photographic map. No constellation lines or new HUD are added to exploration.

## Sources and limits

- [HYG v4.1](https://github.com/astronexus/HYG-Database/tree/c7f7f883fe678cc7680169a50ccd7dcc49b060ce): David Nash / Astronexus compilation of Hipparcos, Yale Bright Star and Gliese data. The adapted subset is CC BY-SA 4.0; [field definitions and reproducible extraction](../src/sky/data/README.md), [attribution](../public/licenses/hyg-stars.txt), [license text](../public/licenses/CC-BY-SA-4.0.txt). The license applies to the adapted catalog data, separately from the application code.
- [US Naval Observatory: sidereal time](https://aa.usno.navy.mil/faq/GAST) and [equatorial to horizon coordinates](https://aa.usno.navy.mil/faq/alt_az).
- [ERFA / SOFA IAU 1976 precession](https://github.com/liberfa/erfa/blob/master/src/prec76.c), including validity near 1901. Tests use an independent SOFA precession fixture.
- [ERFA ICRS/galactic transformation](https://github.com/liberfa/erfa/blob/master/src/g2icrs.c) for the galactic pole.

This is a recognizable mean stellar sky, not an astrometric instrument. It retains the existing clock's approximate local-solar-time to UT conversion (equation of time omitted). Nutation, annual aberration, UT1 corrections, atmospheric refraction and perspective acceleration are omitted. Catalog magnitudes are static; binaries are not resolved dynamically. The telescope does not add deep-sky objects, planets or stars fainter than the catalog cutoff. Display radiance, glare and color remain artistic.

## Verification and local review

Run `node test/catalog-stars.mjs` for sidereal/cardinal orientation, independent precession, proper motion, date rollover and catalog/cube seam coverage. Run `node test/catalog-stars-render.mjs` for dated south/north renders, telescope framing and GPU probes at measured bright-star positions. The same render suite also runs with `WEBGPU_DEFAULT_LIMITS=1`.

`node tools/shots/night-sky.mjs` renders matched 22:00 / 02:00 views through the actual game renderer, with a deliberately clear interval. Review images are written to `artifacts/night-sky/`; these checks use no normal game saves. Physical phone/Quest performance and user visual acceptance remain untested.
