# Hesperus (1896) references

Prepared 13 October 2026 for a distant model of the relief tender in the 3 January 1901 setting. `references.json` records each item's source, date, observations and limits; `file-manifest.json` records dimensions and SHA-256 hashes. No game code or model has been changed by this reference-gathering task.

The images are **not in git**. `.gitignore` here excludes them: Lloyd's Register permits download for personal, non-commercial use only, and the photograph is Manx National Heritage / Bridgeman copyright. The catalogue records each item's source page, which carries its download link, so the set can be fetched again.

## The ship

Steel twin-screw steamer built by Gourlay Brothers & Co, Dundee, as yard no. 171 for the Commissioners of Northern Lighthouses. Launched 22 October 1896, classed 11 December 1896, registered at Leith, based at Oban. Official number 104924. Renamed *Ascog* in 1939 and broken up in 1940.

| | |
|---|---|
| Length between perpendiculars | 175 ft 0 in (53.34 m) |
| Breadth moulded | 28 ft 0 in (8.53 m) |
| Depth moulded | 14 ft 6 in on the drawings (4.42 m) |
| Decks | Two, with a 27.5 ft forecastle, 51.5 ft bridge deck and 53 ft raised quarter deck joined to the bridge; well deck forward |
| Rig | Schooner, two raked steel pole masts with pine topmasts, gaffs and derricks |
| Funnel | One, raked |
| Boats | Four |
| Hull | Straight stem, elliptical counter stern, clincher (in-and-out) plating |
| Speed | 12 knots |

## What is here

- **Builder's drawings (Lloyd's Register Foundation, 22 records, 37 scans).** The rigging plan is a complete outboard profile at 1/8 inch to the foot and is the controlling silhouette. The corrected profile and deck plans give every deck in plan, the deckhouse footprints and hull sections at three frames. The midship section, after-end sheet, mast plan and rudder plan fill in shape. The 19 May profile sheet is docketed *cancelled*; use the 16 July corrected sheet.
- **First-entry survey report, 4 December 1896.** The written specification: deck lengths, mast lengths, four boats, stockless anchors, teak rails and skylights, pitch pine decks.
- **One photograph of the ship**, alongside at Ramsey, Isle of Man, port side, sometime between December 1896 and 1910. It agrees with the rigging plan and adds the bow badge and the tonal scheme.
- **`analogues/`**: three small photographs of other Board tenders, for fleet character only.

## What is still missing

- **Colour.** Nothing downloaded is in colour. A builder's display model in a museum in Oban shows black topsides, a red-brown underwater body, white upperworks and boats, and a plain buff funnel and masts. It was seen only as a stock-library preview and was not saved; a model is also the builder's presentation finish, not proof of her paint in 1901. The Ramsey plate is consistent with it in tone.
- **A lines plan.** Hull form between the sections has to be faired by eye.
- **A photograph dated near 1901.** The National Archives holds one registered by an Oban photographer in May 1902 (COPY 1/455/342). It is not digitised.
- **General arrangement plans** reported at the Mitchell Library, Glasgow.
- **Unread records.** Two reading passes are recorded in `measurements.md`. The first covers the corrected profile and deck plans, the midship section, the after-end sheet and the second page of the survey report. The second covers the rigging plan in detail (rigging leads, derricks, davits, lights, deck machinery), the mast plan, the rudder plan, the gas tank sheet, the plumber-work profile, the second page of the electric lighting report and the top of the machinery report. Still unread: the rest of the machinery report (boilers and donkey boiler), the classing remarks, both 1897 Glasgow surveys, the lower third of the 1899 survey, and the bilge-pumping and boiler drawings. None of the records read so far states a colour.

## What the records say about the inside

Enough to place rooms, not to furnish them. The drawings name and bound the *Chart House* and *Steam Steering Gear* house on the bridge (walls, partition, 1.93 m headroom, five windows a side), the *Galley* between the engine and boiler casings (with a salt water lift force pump and a fresh water pump in it, and its own skylight), and the after deckhouse, divided into a *Saloon Entrance* with a hatch in its floor and a *State Room*. Below the quarter deck they give the cabin sole (frame 1 to frame 20, 7 ft 11 in under the deck), two skylights and the row of side scuttles. The lighting report gives 79 electric lamps and two compasses. The main deck plan also labels *Officers Rooms* to port and *Steel Side Houses* to starboard of the casings, baths beside the engine casing and the crew's companion under the forecastle.

No sheet in the set shows a joiner bulkhead below decks, a door, panelling or a piece of furniture. The rooms in `tools/ships/hesperus_interiors.py` therefore take their walls from the drawings where a wall is drawn and are reconstruction everywhere else; the notes at the foot of that file list which is which. General arrangement plans reported at the Mitchell Library would settle the cabin layout.

Figures quoted from the handwritten survey forms were read from reduced scans. Recheck any number at full size before it drives geometry.

Do not substitute the 1873 clipper ship *Hesperus* or the 1939 motor tender *Hesperus* (II). Most "Hesperus" images online are one of those two.
