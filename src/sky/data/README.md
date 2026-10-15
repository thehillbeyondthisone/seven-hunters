# Bright star catalog

`bright-stars.json` contains 8,920 HYG Stellar Database v4.1 records with catalog visual magnitude at most 6.5. It includes the entire sky, not only the stars visible from Flannan. Sol is omitted. Source right ascension is converted from hours to degrees and unneeded fields are omitted; positions retain the source precision.

The data and this adapted subset are licensed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/), attributed to David Nash / Astronexus. See [the distributable attribution notice](../../../public/licenses/hyg-stars.txt) and [the license text](../../../public/licenses/CC-BY-SA-4.0.txt). This dataset has its own license independently of the application's code.

The pinned upstream CSV is from commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce` of [Astronexus/HYG-Database](https://github.com/astronexus/HYG-Database), dated 2025-02-14. The project's current upstream is [Astronexus on Codeberg](https://codeberg.org/astronexus/hyg). The uncompressed source CSV SHA-256 is `d9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd`. The pinned source was acquired 2026-10-12.

Rows are arrays in the order specified by `columns`:

| Column | Meaning |
| --- | --- |
| `id` | HYG primary identifier |
| `hip` | Hipparcos identifier, or `null` |
| `name` | Common name, or Bayer/Flamsteed designation, or empty string |
| `ra` | J2000.0 right ascension, degrees |
| `dec` | J2000.0 declination, degrees |
| `mag` | Apparent visual magnitude |
| `ci` | B minus V color index, or `null` |
| `pmra` | Proper motion in right ascension times cos(declination), milliarcseconds per Julian year |
| `pmdec` | Proper motion in declination, milliarcseconds per Julian year |

Both the epoch and equinox of the HYG source are J2000.0. The renderer must apply proper motion and precession to the setting's date before using local sidereal time to orient the sky. HYG magnitudes are static catalog values; this subset does not simulate variable stars, orbital companions, planets, galaxies, or deep sky objects. The rendered point sizes and brightness are artistic exposure choices rather than a photometric instrument model.

Rebuild using the pinned upstream URL:

```sh
node tools/sky/build-star-catalog.mjs --download
```

That command caches a gzip copy under ignored `.local/sky/`. Rebuild offline from that copy, or pass another local CSV/gzip file explicitly:

```sh
node tools/sky/build-star-catalog.mjs
node tools/sky/build-star-catalog.mjs .local/sky/hygdata_v41.csv.gz
```

The JSON stores the upstream source URL, commit, and SHA-256. It is bundled at build time; no catalog service is requested during play.

Astrometry references: [USNO sidereal time](https://aa.usno.navy.mil/faq/GAST), [USNO horizon coordinates](https://aa.usno.navy.mil/faq/alt_az), [ERFA IAU 1976 precession reference](https://github.com/liberfa/erfa/blob/master/src/prec76.c), and [ESA Hipparcos field definitions](https://www.cosmos.esa.int/web/esdc/esasky-catalogues).
