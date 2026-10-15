# Hesperus (1896): measurements read from the drawings and survey forms

Read 13 October 2026 from the local scans listed in `references.json`. Every value says whether it is a figure **written** on the record or **scaled** off the drawing, and carries a confidence mark (high / medium / low). Pixel positions are in the 2000 px wide scans, so any reading can be checked with a crop.

Model coordinates: metres. X forward from the aft perpendicular (after side of the stern post), Z up from the moulded base line (top of the bar keel), Y half-breadth from the centreline.

Sections 4, 6 and most of 7 of the original brief (mast plan, rudder plan, the machinery, lighting and repair reports, plumber-work sheets) were **not read**; see the end of the file.

## 0. Calibration

### 0.1 Frame numbering and the aft perpendicular (affects every X in the model)

| Finding | Value | Source | Confidence |
|---|---|---|---|
| Frame spacing | written: 'Frames ... Spaced 22" apart' = 0.5588 m | 0125-a text block | high |
| Frame 0 is at the **fore** side of the stern post, not the after side | scaled: on 0134 the post is 10 px wide (px 270.5 to 280.5) and frames 1 to 5 extrapolate back to px 280; on 0124 the post is px 206.8 to 212.5 and frames 3 to 26 extrapolate to px 212.2 | 0134-a, 0124-a | high |
| Stern post size | written: 'Stern post 6" x 2 7/8"' (0134) ; 'Sternpost 6[?]" x 2 7/8"' with a red-ink correction (0125) | 0134-a, 0125-a | high for 6 in fore-and-aft |
| So frame n lies at | **X = 0.152 + 0.5588 n** (not n x 0.5588) | derived | high for the offset being 0.15 to 0.19 m |
| Check at the bow | stem fore face at frame 95.22 on 0124, giving X = 53.36 m against 53.34 m (175 ft) | 0124-a | high |

Deck ends in frames (these reproduce the survey report's register lengths, which confirms the frame reading):

| Feature | Frame | X (m) | Check |
|---|---|---|---|
| Raised quarter deck / bridge break (steel bulkhead) | 29 | 16.36 | 29 x 22 in = 53.2 ft; report says R.Q.D. 53 ft |
| Bridge front bulkhead | 57 | 32.00 | 28 frames = 51.3 ft; report says bridge deck 51 1/2 ft |
| Forecastle break | 80 | 44.86 | to the stem 27.8 ft; report says forecastle 27 1/2 ft |

### 0.2 Sheet calibrations

| Sheet | Horizontal | Vertical / transverse | How verified | Confidence |
|---|---|---|---|---|
| `lr-0124-...-a` inboard profile and all deck plans (profile and plans share the same x registration) | Frame ticks read at y = 586: fr 3 = 264.0, 8 = 350.0, 17 = 505.2, 26 = 660.9, 37 = 853.2, 48 = 1042.9, 59 = 1235.5, 70 = 1425.3, 80 = 1600.6, 87 = 1721.7. Spacing drifts from 17.26 px/frame aft to 17.44 forward (mean 17.37 = 31.08 px/m). **AP at px 206.8**, frame 0 at px 212.2, stem face px 1865. Convert through the frame table, not a single linear fit. | Profile: 31.1 px/m assumed equal to horizontal. Keel underside is the lowest line, y = 595.2 at px 225, 597.0 at 530, 597.9 at 1045, 598.0 at 1200, 599.0 at 1400 to 1640 (sheet tilted 0.16 deg). Base line (top of keel) is 6 in = 4.7 px above it. Plans: 30.6 px/m (+/- 2 %) transversely; centrelines y = 807.2 (px 150) to 809.5 (px 1100) for the R.Q.D./bridge/forecastle plans, 1103.5 to 1106 for the main deck plan, 1402 for the lower deck plan. Half-breadths below are taken as half the distance between the two sides. | Frame labels and ticks; LBP check; depth check (keel underside to main deck beam at centre amidships 149 px = 4.79 m against 4.78 m expected); after hatch drawn 69.5 x 65 px against 7 ft 4 in x 7 ft 0 in in the survey report. | high in X, medium in Y and Z |
| `lr-0134-...-a` after-end sheet, scale written '1/4" = one foot' | Profile: frame ticks fr 4 = 396.2 ... fr 50 = 1740.0, 29.2 px/frame = 52.3 px/m; frame 0 at px 279.5, **AP at px 271.5**. The cabin sole plan lower on the sheet has its own registration: frame n at px 275.8 + 28.81 n (51.6 px/m). | 52.3 px/m assumed. Keel: top of bar keel y = 597 at px 440, 600.5 at 730, 602 at 875, about 605 at 1105 (sheet tilted about 0.7 deg); about 595 at the stern post. | Frame labels; quarter deck to keel in the section at bulkhead 20 = 19.5 ft as expected; stiffener spacings written 2 ft 6 in and 30 in scale at 16.1 px/ft. | high in X, medium in Z |
| `lr-0125-...-a` midship section, scale written '1/2 in = 1 Foot' | Centreline px 1088. Outer shell maximum at px 1606 (y = 1000), so 518 px = 14.0 ft moulded half-breadth, 36.9 px/ft. | Written 4 ft 0 in bulwark height spans 142 to 145 px; written 14 ft 6 in depth spans about 527 px: 36.3 px/ft. Top of keel y = 1233 to 1235, bar keel to y = 1250. | Written dimensions on the sheet. | medium |

### 0.3 Disagreements with the calibrations supplied in the brief

| Supplied | Found | Effect |
|---|---|---|
| 0126 rigging plan: px = 228 + 31.006 X | Scale confirmed (stern post to stem face 1653.5 px = 53.34 m, 31.0 px/m). But the after side of the stern post is at **px 221.5**; the stem face is at px 1875. The sheet has dotted frame lines below the waterline at px 244, 261, 278, 296 ... (17.2 px apart), which put frame 0 at px 226.8. Px 228 is therefore frame 0 (fore side of the post), not the AP. | The model's X origin sits 0.21 m forward of the true AP. In model coordinates the stern post's after face is at X = -0.21 and the stem face at X = 53.13, not 53.34. Harmless if everything is placed by the same formula; wrong for anything placed at a nominal 53.34. |
| 0124 plans: 30.34 px/m, AP at px 228.4 | 31.08 px/m mean, AP at px 206.8, frame 0 at px 212.2. Px 228.4 is the after tip of the *cabin sole* outline (frame 1), which sits low in the hull and ends forward of the stern post. | The supplied fit agrees with the true one amidships and compresses toward the ends: positions read with it are 0.35 to 0.4 m too far forward at X 35 to 39, and about 0.5 m too far aft at X 1 to 6, relative to the rigging-plan formula. |
| Frame n at X = n x 0.5588 | From the true AP, X = 0.152 + n x 0.5588. In the model's rigging-plan coordinates, frame n is at about n x 0.5588 - 0.04. | |
| 0125 keel at py 1235 | Confirmed as the top of the bar keel (moulded base). The keel bar extends 6 in below, to py 1250. | none |

**Two X columns follow from this.** Every X in sections 1 to 3 is measured from the true AP (after side of the stern post). To place an item in the model as it stands (origin at rigging-plan px 228), use **X_model = X - 0.21**. Section 1.6 is already converted.

## 1. Deck layouts in plan (sheet 0124)

Port is at the top of the sheet (bow to the right), starboard at the bottom. Y positive to port where a side is given. X from the frame table; Y at 30.6 px/m.

### 1.1 Raised quarter deck (stern to frame 29)

| Item, label as written | px x from / to | Frames | X from / to (m) | px y from / to | Y (m) | Confidence |
|---|---|---|---|---|---|---|
| Deck outline, after extremity (taffrail) | 132 | -4.65 | -2.44 | | 0 | high |
| Plated patch round the rudder head, '5/20' | 151 / 212 | -3.6 / 0.0 | -1.83 / 0.15 | 792.4 / 821.2 | +/- 0.47 | medium |
| 'STEEL DECKHOUSE' (rounded corners) | 260 / 403 | 2.8 / 11.1 | **1.70 / 6.34** | 770 / 845 | **+/- 1.23** | high for position in frames, medium for width |
| 'Hatch' inside the deckhouse (opening to the saloon below) | 293 / 339 | 4.7 / 7.4 | 2.77 / 4.27 | 775.5 / 803.8 | 0.12 to 1.05 port | medium |
| 'Skylight' (saloon skylight, hard against the deckhouse front) | 403 / 463.3 | 11.1 / 14.6 | 6.34 / 8.29 | 786.3 / 828.8 | +/- 0.69 | high |
| 'Sky light' (small, thwartship) | 513.7 / 532.7 | 17.5 / 18.6 | 9.93 / 10.54 | 785.7 / 827 | +/- 0.68 | high |
| 'MAST' circle (mainmast at the deck) | centre 569, 12 px diameter | 20.7 | **11.71** | centre 808 | 0 ; diameter about 0.39 m | high |
| Dashed plate, '6/20' (doubling under the deck abaft the hatch, probably the winch seat) | 584 / 619 | 21.6 / 23.6 | 12.20 / 13.33 | 783 / 832 | +/- 0.80 | medium for extent, low for purpose |
| 'Cargo Hatch' (rounded corners) | 626.5 / 696 | 24.0 / 28.0 | **13.57 / 15.80** | 776 / 841 | **+/- 1.06** | high |
| Tie plates under the deck, '9" x 6/20' widening to '14 1/2" x 6/20' beside the deckhouse | | | | 765 to 775 and 839 to 849 | | not exterior |
| Break of the deck: steel bulkhead | 714 | 29.0 | 16.38 | | | high |

The deck is otherwise bare on the drawing: no bitts, fairleads, winch, capstan, davits or rail stanchions are drawn on this sheet.

### 1.2 Bridge deck (frame 29 to frame 57)

| Item, label as written | px x from / to | Frames | X from / to (m) | px y from / to | Y (m) | Confidence |
|---|---|---|---|---|---|---|
| 'COMPANION OF TEAK' | 713 / 748 | 29.0 / 31.0 | 16.38 / 17.46 | 850 / 887 | 1.35 to 2.56 **starboard** of the centreline | medium. Re-read at 9x: a rectangle against the after edge of the bridge deck, off-centre to starboard, 1.08 m fore and aft by 1.21 m. |
| 'Engine Casing' (opening with a cross; carries the engine skylight) | 772.3 / 876 | 32.4 / 38.3 | **18.24 / 21.57** | 772.5 / 845 | **+/- 1.18** | high |
| Bare deck between the casings, '5/20' plating beneath (galley roof) | 876 / 957.7 | 38.3 / 43.1 | 21.57 / 24.21 | | | high |
| 'Galley Skylight' | 922 / 940.2 | 41.0 / 42.0 | 23.06 / 23.65 | 792 / 825 | +/- 0.54 | high |
| 'Boiler Casing' (opening with a cross; carries the funnel) | 957.7 / 1061.7 | 43.1 / 49.1 | **24.21 / 27.57** | 772.5 / 845 | **+/- 1.18** | high |
| Bridge deck front edge | 1200.5 | 57.0 | 32.00 | 690 / 929 | +/- 3.91 | high |

The funnel, the chart house and the bridge wings, boats and davits are **not drawn in this plan**; the plan is a structural one. The chart house appears only in the profile (section 2).

At bridge-deck level the engine and boiler casings are two separate openings 2.64 m apart, with open deck and the galley skylight between them. The single long casing (X 18.0 to 27.5) exists only one deck down, inside the enclosed bridge space (1.4).

### 1.3 Forecastle deck (frame 80 to the stem; small plan at the upper right)

| Item | px x from / to | Frames | X from / to (m) | px y from / to | Y (m) | Confidence |
|---|---|---|---|---|---|---|
| Break (after edge) | 1600 to 1603 | 80.0 | 44.86 | 713 / 905 | +/- 3.12 | high |
| Dashed square, unlabelled, on the centreline inside the plated strip | 1665 / 1707 | 83.7 / 86.2 | 46.94 / 48.29 | 783 / 835 | +/- 0.85 | medium for extent; low for identity (windlass seat or doubling; nothing says which) |
| Centre plated strip '5/20' (deck plating under the wood, tapering to a point) | 1600 / about 1838 | 80 / 93.7 | 44.9 / 52.5 | 781 / 838 | +/- 0.93 | medium |
| Stem head | 1858 to 1868 | 94.8 to 95.4 | 53.1 to 53.4 | | 0 | high |

No windlass, hatch, companion, bitts, catheads or hawse pipes are drawn on the forecastle plan. The survey report names the windlass maker (Clarke, Chapman & Co) but gives no position.

### 1.4 Main deck (frame 29 forward; the same plan aft of frame 20 is the cabin sole)

Inside the enclosed bridge space (frames 29 to 57, sides plated up to the bridge deck, so not visible from outside):

| Item, label as written | px x from / to | X from / to (m) | px y from / to | Y (m) | Confidence |
|---|---|---|---|---|---|
| 'Steel Bulkd' at the after end | 713 | 16.36 | | full breadth | high |
| 'Engine Casing' at main-deck level | 764.7 / 887 | 18.00 / 21.92 | 1058 / 1150.5 | +/- 1.51 | high |
| 'Galley' (between the casings, same walls) | 887 / 957 | 21.92 / 24.19 | 1058 / 1150.5 | +/- 1.51 | high |
| 'Boiler Casing' at main-deck level | 957 / 1060 | 24.19 / 27.52 | 1058 / 1150.5 | +/- 1.51 | high |
| 'Officers Rooms' (port side, hull to the casing wall; stepped in forward of px 1040) | 713 / 1110 | 16.4 / 29.1 | 981 / 1058 | 1.5 to 4.06 port | medium |
| 'Steel Side Houses' (starboard), after block | 713 / 904 | 16.4 / 22.5 | 1181 / 1228 | 2.48 to 4.03 stbd | medium |
| 'Steel Side Houses' (starboard), forward block | 956 / 1199 | 24.2 / 32.0 | 1181 / 1228 | 2.48 to 4.03 stbd | medium |
| Gap between the two side houses (a side entrance or coaling space; unlabelled) | 904 / 956 | 22.5 / 24.2 | | starboard side | low |
| 'Officers Rooms (steel)' block at the fore end | 1131 / 1197 | 29.79 / 31.89 | 1055 / 1150 | +/- 1.55 | medium |
| 'Bridge Bulkhd' (front of the bridge) | 1196.6 to 1200 | 31.9 to 32.0 | | full breadth | high |

Well deck (frames 57 to 80):

| Item, label as written | px x from / to | Frames | X from / to (m) | px y from / to | Y (m) | Confidence |
|---|---|---|---|---|---|---|
| 'Gangway', port and starboard (door symbol in the bulwark) | 1296 / 1380 | 62.5 / 67.4 | 35.08 / 37.80 | at the deck edge | both sides | high |
| 'Hatch' (small) | 1286 / 1320.5 | 61.9 / 63.9 | **34.76 / 35.87** | 1087 / 1118 | +/- 0.51 | high |
| 'Cargo Hatch' (rounded corners), as drawn | 1320.5 / 1407.5 | 63.9 / 69.0 | **35.87 / 38.69** | 1062 / 1147 | +/- 1.39 as drawn | high for length |
| Same hatch: black ink figure across the breadth | written '8\'-0"' | | | | **+/- 1.22** | high (agrees with the survey report, 9 ft 2 in x 8 ft 0 in) |
| Dashed plate '5/20' just forward of the hatch | about 1412 / 1437 | 69.2 / 70.7 | 38.8 / 39.6 | 1075 / 1128 | +/- 0.87 | low |
| Mast partner plate 'MAST 7/20' (square) | 1458 / 1494 | 71.9 / 73.9 | 40.31 / 41.46 | 1088 / 1120 | +/- 0.52 | medium |
| Foremast circle | centre 1472, 12 px diameter | 72.7 | **40.76** | centre 1104 | 0 ; diameter about 0.39 m | high |
| 'Buoy Gangway' (starboard side only) | 1480 / 1568 | 73.1 / 78.1 | 41.01 / 43.82 | starboard deck edge | starboard | medium (extent from the dashed box in the profile, labelled 'Buoy gangway on Starbd side') |

Under the forecastle (frames 80 to stem, not visible from outside except through the break):

| Item | px x from / to | X from / to (m) | px y | Y (m) | Confidence |
|---|---|---|---|---|---|
| Forecastle break bulkhead | 1599 to 1600.6 | 44.8 to 44.9 | | | high |
| 'Comp' (crew's companion; 'Crews Compan' in the profile) | 1620 / 1668.8 | 45.48 / 47.06 | 1091 / 1119 | +/- 0.46 | high |
| Plated side compartments '5/20', port and starboard | about 1598 / 1717 | 44.8 / 48.6 | 1040 to 1062 and 1150 to 1170 | 1.4 to 2.1 off centre | low |

Cabin sole (same plan, aft): the accommodation floor runs from frame 1 (px 229, X 0.70) to the watertight bulkhead at frame 20 (px 552 to 558, X 11.2 to 11.35). Between frames 20 and 29 the plan shows only the stringer of the open after hold.

### 1.5 Deck outlines (half-breadth, outer line of each plan)

Y is given at 30.6 px/m. The same points at the sheet's horizontal scale (31.08 px/m) are 1.5 % smaller. See 1.7 for how far these plan breadths can be trusted.

Raised quarter deck and bridge deck edge:

| X (m) | -2.44 | -2.41 | -2.19 | -2.02 | -1.86 | -1.54 | -1.21 | -0.89 | -0.57 | -0.24 | 0.70 | 1.83 | 2.93 | 4.04 | 5.17 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m) | 0 | 0.85 | 1.69 | 1.92 | 2.08 | 2.32 | 2.50 | 2.65 | 2.77 | 2.86 | 3.06 | 3.24 | 3.35 | 3.44 | 3.52 |

| X (m) | 6.31 | 7.44 | 8.54 | 9.65 | 10.78 | 11.91 | 13.04 | 14.13 | 15.23 | 16.09 | 16.63 (bridge) | 21.08 | 25.58 | 28.96 | 31.83 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m) | 3.59 | 3.65 | 3.69 | 3.73 | 3.77 | 3.81 | 3.84 | 3.86 | 3.89 | 3.91 | 3.92 | 3.89 | 3.91 | 3.92 | 3.91 |

The bridge deck is parallel-sided at 3.90 m from frame 29 to its front at frame 57. Confidence: high for shape, medium for absolute breadth.

Forecastle deck edge:

| X (m) | 44.93 | 45.71 | 46.81 | 47.94 | 49.03 | 50.15 | 51.28 | 51.92 | 52.40 | 52.72 | 52.94 | 53.07 | 53.13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m) | 3.12 | 2.98 | 2.76 | 2.50 | 2.19 | 1.80 | 1.30 | 0.95 | 0.65 | 0.42 | 0.26 | 0.15 | 0 |

Main deck edge (frame 29 forward) and, aft of frame 20, the hull at cabin-sole level (Z about 3.4 to 3.7 m, so effectively a waterline of the run):

| X (m) | 0.70 | 0.89 | 1.05 | 1.38 | 1.83 | 2.38 | 2.93 | 4.04 | 5.17 | 6.31 | 7.44 | 8.54 | 9.65 | 10.78 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m), cabin sole | 0.45 | 0.58 | 0.71 | 0.96 | 1.29 | 1.65 | 1.98 | 2.47 | 2.80 | 3.09 | 3.29 | 3.44 | 3.57 | 3.70 |

| X (m) | 11.91 | 13.04 | 14.13 | 15.23 | 16.09 | 17.72 | 21.08 | 24.48 | 26.69 | 28.96 | 31.16 | 32.82 | 33.95 | 35.05 | 36.18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m), main deck level | 3.77 | 3.84 | 3.89 | 3.94 | 3.97 | 4.00 | 4.05 | 4.05 | 4.06 | 4.05 | 4.03 | 4.00 | 3.99 | 3.96 | 3.93 |

| X (m) | 37.32 | 38.45 | 39.55 | 40.66 | 41.74 | 42.92 | 44.01 | 45.13 | 46.26 | 47.39 | 48.49 | 49.61 | 50.73 | 51.60 | 52.24 | 52.72 | 53.19 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m) | 3.87 | 3.78 | 3.69 | 3.57 | 3.44 | 3.27 | 3.09 | 2.90 | 2.66 | 2.33 | 2.01 | 1.61 | 1.20 | 0.82 | 0.48 | 0.23 | 0 |

Lower deck plan: maximum half-breadth 132 px = 4.31 m (at 30.6 px/m) or 4.25 m (at 31.08) amidships, against 4.27 m moulded. Outline not tabulated.

### 1.6 Comparison with the model values quoted by the lead

This table is in **model coordinates** (X_model = X - 0.21, origin at rigging-plan px 228), so the two X columns compare directly.

| Model item | Model | Drawings, in model coordinates | Verdict |
|---|---|---|---|
| After deckhouse | X 1.25 to 6.0, half-width 1.35 | 0124 plan: 1.49 to 6.13, half-width 1.23. 0124 profile: 1.55 to 6.16. 0134 profile: 1.75 to 6.30. Rigging plan itself (walls at px 275.3 and 416.6): 1.53 to 6.08; its roof runs px 271 to 422 (1.39 to 6.26). | Move the after wall forward about 0.28 m to X 1.5; forward wall 6.1. Length 4.56 m (15 ft), not 4.75. Half-width 1.23, not 1.35 (medium: one plan, 30.6 px/m). Roof overhangs about 0.13 m aft and 0.17 m forward. |
| Engine / boiler casing | X 17.97 to 27.5, half-width 1.16, top Z 7.19 | On the bridge deck there are two casings: engine 18.03 to 21.36 and boiler 24.00 to 27.36, each half-width 1.18, with 2.64 m of open deck between them carrying the galley skylight (22.85 to 23.44, half-width 0.54). The single 17.8 to 27.3 casing exists only at main-deck level inside the bridge space, where its half-width is 1.51. Coaming top 18 in above the bridge deck (written): Z 7.14 to 7.2. Engine skylight on the after casing rises a further 0.61 m, to Z 7.7 to 7.8. | Ends, half-width and coaming height agree. Split the casing in two, leave open deck between, and add the engine skylight box on the after one. The funnel stands on the forward one, centre X 24.98. |
| Wheelhouse | X 27.32 to 31.03, half-width 1.6 | Profile only: walls 27.34 to 31.04, partition at 29.03 ('Chart House' abaft it, 'Steam Steering Gear' before it), roof 27.18 to 32.00, overhanging the front wall by 0.96 m to the bridge front. No plan view of the house exists on these sheets, so the width cannot be checked. | Agrees to 0.02 m. Check the roof overhang. |
| After hatch | X 13.2 to 15.5 | 13.36 to 15.59 (0124 plan), 13.37 to 15.57 (0134 profile), half-width 1.06. Survey: 7 ft 4 in x 7 ft 0 in x 12 in coaming. | Move forward 0.1 to 0.15 m; length 2.23 m. |
| Fore hatch | X 36.0 to 38.9 | 35.66 to 38.48; breadth written 8 ft 0 in (half-width 1.22). Survey: 9 ft 2 in x 8 ft 0 in x 12 in coaming. | Model hatch is 0.35 to 0.4 m too far forward (it matches the superseded 30.34 px/m fit exactly). Length 2.80 m, not 2.9. |
| Small hatch | X 34.9 to 36.0 | 34.55 to 35.66, half-width 0.51; shares its forward coaming with the fore hatch | Move aft 0.35 m. |
| Mainmast at the quarter deck | not quoted | 11.50 (0124), 11.46 (0134), 11.39 (rigging plan, scaled here) | the three sheets agree within 0.11 m |
| Foremast at the main deck | not quoted | 40.55 to 40.58 (0124 plan and profile) | |

Other deck items, in model coordinates, for which no model value was quoted: saloon skylight 6.13 to 8.08 (half-width 0.69, 0.96 m high); small skylight 9.72 to 10.33 (half-width 0.68); teak companion 16.17 to 17.25, 1.35 to 2.56 m to starboard, about 0.95 m high; gangways port and starboard 34.87 to 37.59; buoy gangway (starboard only) 40.80 to 43.61; crew's companion under the forecastle 45.27 to 46.85; forecastle break 44.65; bridge front 31.79; quarter deck / bridge break 16.15.

### 1.7 Limits of the plan breadths

The 0124 plans read 0.1 to 0.15 m narrower in half-breadth than the larger-scale drawings at two places, and the difference cannot be removed by one transverse scale factor:

| Place | 0124 plan (30.6 px/m) | Larger-scale drawing |
|---|---|---|
| Main deck at side, amidships | 4.06 m | 0125 midship section: 4.15 m (13.63 ft) |
| Raised quarter deck edge at frame 20 | 3.79 m | 0134 section at bulkhead 20: 3.85 m at the deck, 3.87 m maximum |
| Bridge deck edge amidships | 3.91 m | 0125: about 3.93 m (12.9 ft) |
| Lower deck amidships | 4.31 m | 0125: 4.27 m moulded |
| Cabin sole at frame 20 | 3.73 m (at 30.6), 3.67 m (at 31.08) | 0134 cabin sole plan: 3.69 m |

Use the 0125 and 0134 figures for absolute breadths where they exist and the 0124 curves for the shape along the length.

## 2. Inboard profile (sheet 0124, checked against the 0134 profile at twice the scale)

Z is scaled at 31.1 px/m above the base line (keel underside line less 6 in). The profile draws each deck as a double line about 2.5 px apart: plank top and beam top at the centreline. Values are beam top at centre unless stated. Deck at side is lower by the round of beam (written 8 in = 0.20 m at full breadth).

### 2.1 Written vertical dimensions (0125 midship section)

| Dimension | As written | Metres | Confidence |
|---|---|---|---|
| Depth moulded, to the main deck at side | '14\'-6" at lowest point' | 4.42 | high |
| Main deck to raised quarter deck | '4\'-0"' | 1.22 | high |
| Main deck to bridge deck | '6\'-9"' | 2.06 | high |
| Raised quarter deck to cabin sole | '7\'-11"' | 2.41 | medium (figure small; reads 7-11) |
| Main deck to lower deck | '6\'-6"' | 1.98 | medium |
| Round of beam on main, quarter and bridge decks | '8" round' (written three times) | 0.20 | high |
| Engine and boiler casing coaming above the bridge deck | '18"' and 'Coaming 18" x 6/20' | 0.46 | high |
| Bulwark, main deck at side to rail | '4\'-0"' | 1.22 | high (the survey report says 3-9; see 7) |

From these, amidships: main deck 4.42 at side and 4.62 at centre; raised quarter deck 5.64 / 5.84; bridge deck 6.48 / 6.68; lower deck 2.44 at side; casing coaming top about 7.14 (above the beam) to 7.2 (above the wood deck).

### 2.2 Deck heights scaled from the profiles

| Deck | Station | px (x, y) | Z (m) | Source | Confidence |
|---|---|---|---|---|---|
| Main deck | amidships, X 27 to 32 | (1100 to 1226, 448) | 4.67 | 0124 | high (written dimensions give 4.62) |
| Main deck | X 39.6 | (1434, 444.5) | 4.82 | 0124 | medium |
| Main deck | X 42.3 | (1520, 441.8) | 4.90 | 0124 | medium |
| Main deck | forecastle break, X 44.9 | (1600, 438.5) | 5.01 | 0124 | medium |
| Main deck | X 46.8 | (1661, 435.5) | 5.11 | 0124 | medium |
| Main deck | X 48.5 | (1713, 432) | 5.22 | 0124 | medium |
| Main deck | X 51.0 | (1790, 426.3) | 5.40 | 0124 | medium |
| Main deck | at the stem, X 52.7 | (1845, 420.5) | 5.59 | 0124 | medium |
| Raised quarter deck | taffrail, X -1.9 | (150, 398.5) | 6.17 | 0124 (0134 gives 6.3) | medium |
| Raised quarter deck | X 0.6 | (225, 401) | 6.09 | 0124 | medium |
| Raised quarter deck | X 4.9 | (358, 404) | 6.03 | 0124 (0134: 6.05 at X 3.8) | medium |
| Raised quarter deck | X 7.7 | (445, 405.4) | 6.00 | 0124 (0134: 6.00 at X 6.0) | medium |
| Raised quarter deck | X 10.4 | (530, 406.8) | 5.96 | 0124 (0134: 5.99 at X 11.5) | medium |
| Raised quarter deck | X 12.7 | (600, 409) | 5.90 | 0124 | medium |
| Raised quarter deck | at the break, X 15.6 | (690, 412.5) | 5.79 | 0124 (0134: about 5.99; written dimensions give 5.84) | medium |
| Bridge deck | whole length, drawn level | (740 to 1190, 382) | 6.78 | 0124 | medium: 0134 gives 6.66 and the written 6 ft 9 in gives 6.68. Use 6.68. |
| Forecastle deck | at the break, X 44.9 | (1600, 369.5) | 7.24 | 0124 | medium |
| Forecastle deck | X 48.5 | (1713, 362) | 7.47 | 0124 | medium |
| Forecastle deck | X 51.0 | (1790, 356.5) | 7.65 | 0124 | medium |
| Forecastle deck | at the stem | (1860, 350) | 7.86 | 0124 | medium |
| Stem head (top of the bow bulwark) | X 53.4 | (1866, 335) | 8.34 | 0124 | medium |
| Cabin sole | X 4.6 to 11.3 | (350 to 557, 481) | 3.55 | 0124 (0134 profile 3.66 to 3.71; 0134 sections 3.4 to 3.6) | medium |
| Watertight flat (trimming tank top, after hold floor) | X 4.6 / 9.65 / 16.4 | (350, 508) / (505, 513) / (715, 519) | 2.68 / 2.55 / 2.37 | 0124 | medium |
| Lower deck, forward hold | X 36.8 to 40.1 | (1348 to 1451, 507) | 2.81 (plank top 2.94) | 0124 | low to medium |
| Crew space floor / fore peak tank top | X 42.3 / 46.8 / 51.9 | (1520, 501) / (1680, 495) / (1820, 485) | 3.0 / 3.2 / 3.5 | 0124 | low |

Forecastle height above the main deck at the break: 69 px = 2.22 m (7 ft 3 in), scaled, medium.
Sheer of the main deck forward: about 0.93 m from amidships to the stem. Sheer of the raised quarter deck: about 0.37 m from the break to the taffrail.

### 2.3 Houses, casings and skylights in profile

| Item | X from / to (m) | Top, px y | Height above its deck | Top Z (m) | Source | Confidence |
|---|---|---|---|---|---|---|
| After deckhouse ('Deckhouse of steel') | 1.76 / 6.37 | 336 aft, 338 forward (deck 401 to 405) | 2.12 m (7 ft 0 in); 0134 gives 2.07 to 2.14 m | 8.2 aft, 8.1 forward | 0124, 0134 | high. A vertical line at px 340 (X 4.3) divides the side. Roof follows the sheer. |
| Saloon skylight | 6.37 / 8.29 (0134: 6.51 / 8.23) | 374.7 to 376 | 0.96 m (0134: 0.96 m) | 6.97 | 0124, 0134 | high for height, medium for length (1.9 m on 0124, 1.7 m on 0134) |
| Small ridge-roofed skylight | 9.93 / 10.54 (0134: 9.76 / 10.52) | peak 386, eaves 393 | peak 0.64 m, eaves 0.4 m (0134: peak 0.55 m) | 6.6 | 0124, 0134 | medium |
| After cargo hatch coaming | 13.62 / 15.93 | 396 to 398 | written 'Coaming 12" high' above the wood deck | about 6.25 | 0124 | high |
| Companion on the bridge deck ('Comp') | 16.31 / 17.37 | 349 aft, 353 forward | 0.9 to 1.0 m; top slopes down forward | 7.7 | 0124 | medium |
| Engine casing coaming | 18.20 / 21.60 | 364 to 368 | written 18 in | 7.14 to 7.2 | 0124, 0125 | high |
| Engine skylight on that coaming ('Engine Skylight' on 0134; teak on iron coamings per the survey report) | 18.20 / 21.60 (0134: 18.37 / 21.63) | 345 | box 0.61 m above the coaming; 1.1 m above the deck in all (0134: 1.07 m) | 7.7 to 7.8 | 0124, 0134 | high |
| Galley skylight (small, domed on 0124, ridge-roofed on 0134) | 23.02 / 23.58 | 368 | 0.39 m (0134: 0.46 m) | 7.1 | 0124, 0134 | medium |
| Boiler / funnel casing, flat top | 24.29 / 27.52 | 364 to 365 | written 18 in | 7.14 to 7.2 | 0124, 0134 | high |
| Funnel at the casing top | centre X 25.19 (px 987.9), fore-and-aft width 53.6 px | | diameter 1.69 m (0134: 1.78 m), rake about 10.9 deg aft (edge slope 0.19); 0134 shows a two-step base ring about 0.25 m high | | 0124, 0134 | medium; top is drawn broken off on both sheets |
| 'Chart House' and 'Steam Steering Gear' house | walls 27.55 / 31.25, partition 29.24 | roof 316 to 318 | 1.93 m to the roof underside, 2.06 m over the roof (0134: 1.99 m) | 8.7 to 8.75 on a 6.68 deck | 0124, 0134 | high for height, medium for the fore wall |
| Chart house roof overhang | 27.39 / 32.21 | | projects 0.96 m ahead of the front wall, to just beyond the bridge front | | 0124 | medium |
| Crew's companion under the forecastle | 45.48 / 47.06 | | full height between main and forecastle decks | | 0124 | high |
| Fore hatch coaming | 35.9 / 38.7 | 432 | written 'Coaming 12" high x 6/20' | about 5.1 | 0124 | high |

### 2.4 Bulwarks and rails in profile

| Item | Reading | Confidence |
|---|---|---|
| Well-deck bulwark, rail top | px y 414 at X 33.95 (Z 5.77), 412.5 at X 38.45 (Z 5.85), 407 at X 42.3 (Z 6.02), 405 at X 43.5 (Z 6.09) | medium |
| Same, relative to the deck | 1.06 m above the deck at centre, about 1.25 m above the deck at side: the written 4 ft 0 in plus the 2 1/2 in rail | high |
| After end of the bulwark | sweeps down in a curve from the bridge deck edge at the bridge front (X 32.0, Z 6.8) to rail height by about X 33.9 | medium |
| Forward end | sweeps up from X 43.5 to the forecastle deck edge at the break (X 44.86, Z 7.24) | medium |
| Bow bulwark | rises from the forecastle deck at about X 50.7 to 0.48 m above it at the stem head | medium |
| Raised quarter deck | no bulwark: the 0125 section draws an open rail with three rail courses, about 3 ft (0.92 m) high, and a half-round moulding at the deck edge | medium |
| Bridge deck side | plated up from the main deck (strakes J and K), with two half-round mouldings written '3 x 1 1/2 solid': one at the bridge deck edge, one about 1.05 m below it | high |

### 2.5 Masts and funnel through the decks

| Item | At | px | X (m) | Z (m) | Rake | Confidence |
|---|---|---|---|---|---|---|
| Mainmast | raised quarter deck | 568.8 (profile), 569 (plan circle); 0134: px 882 | 11.71 (0134: 11.67) | 5.93 | 12.5 deg aft (centre line slope 0.221) on 0124 | high for position, medium for rake |
| Mainmast heel | watertight flat | 592.9 | 12.48 | 2.45 | | medium |
| Foremast | main deck | 1472.9 (profile), 1472 (plan) | 40.79 | 4.82 | 9.3 deg aft (slope 0.163) | high for position, medium for rake |
| Foremast heel | on the floors / keelson | 1493.7 | 41.45 | about 0.7 | | medium |
| Funnel | casing top | 987.9 | 25.19 | 7.2 | 10.9 deg aft | medium |

Mast diameters as drawn: 12 px circles in plan (about 0.39 m). The survey report gives 15 1/2 in (fore) and 14 1/2 in (main) at the partners.

### 2.6 Watertight and other bulkheads (0124 profile)

| Frame | X (m) | Extent as drawn | Label | Confidence |
|---|---|---|---|---|
| 8 | 4.62 | keel to cabin sole | 'W.T. Bulkd', after peak | high |
| 17 | 9.65 | keel to watertight flat | fore end of the water ballast (trimming) tank | high |
| 20 | 11.33 | watertight flat to quarter deck | 'W.T. Bhd', saloon / after hold | high |
| 26 | 14.68 | below the watertight flat | 'W.T. Bhd' in the shaft tunnel | medium |
| 29 | 16.36 | keel to quarter deck | 'W.T. Bulkd', after hold / engine room | high |
| 49 | 27.53 | keel to main deck | 'W.T. Bulkhead', boilers / donkey boiler recess | high |
| 58 | 32.56 | keel to main deck | 'W.T. Bulkhead', coal bunker / gas tank space | high |
| 64 | 35.93 | keel to main deck | written in ink 'watertight bulkhead', gas tanks / hold | medium |
| 76 | 42.62 | lower deck to main deck | 'W.T. Bulkd', crew space | medium |
| 83 | 46.54 | keel upward | collision bulkhead, chain locker abaft the fore peak tank | medium |

The registry form says five bulkheads; the profile draws more than five lines marked watertight because several are partial.

### 2.7 Stern, rudder and stem profiles

Stern and rudder from 0124 (AP at px 206.8, 30.89 px/m locally) with the 0134 values (AP px 271.5, 52.3 px/m) beside them. Outer line in each case.

| Point | 0124 px | 0124 X, Z (m) | 0134 px | 0134 X, Z (m) |
|---|---|---|---|---|
| Taffrail tip | (130.3, 397) | -2.48, 6.22 | (139.7, 262) | -2.52, 6.37 |
| Counter, upper slope | (138.6, 405) | -2.21, 5.96 | (148.5, 270) | -2.35, 6.21 |
| | (149.5, 415) | -1.85, 5.64 | (169.6, 290) | -1.95, 5.83 |
| | (159.9, 425) | -1.52, 5.32 | (180.1, 300) | -1.75, 5.64 |
| Knuckle | (161.5, 426.5) | -1.47, 5.27 | (187, 310) | -1.62, 5.45 |
| Counter, lower slope | (166.9, 430) | -1.29, 5.15 | (208.2, 320) | -1.21, 5.26 |
| | (176.3, 435) | -0.99, 4.99 | (226.2, 330) | -0.87, 5.07 |
| | (184.9, 440) | -0.71, 4.83 | (244.5, 340) | -0.52, 4.88 |
| | (193.4, 445) | -0.43, 4.67 | (263, 350) | -0.16, 4.68 |
| Counter meets the rudder trunk | (201.2, 450) | -0.18, 4.51 | (265, 356) | -0.12, 4.57 |
| Rudder, after edge | (200, 460) | -0.22, 4.19 | (260.2, 370) | -0.22, 4.30 |
| | (197, 470) | -0.32, 3.87 | (246, 390) | -0.49, 3.92 |
| | (191.2, 480) | -0.51, 3.55 | (239, 400) | -0.62, 3.73 |
| | (183.2, 490) | -0.76, 3.23 | (226.3, 420) | -0.86, 3.35 |
| | (176.6, 500) | -0.98, 2.90 | (217, 440) | -1.04, 2.96 |
| | (172, 510) | -1.13, 2.58 | (210, 460) | -1.18, 2.58 |
| Rudder, greatest breadth | (167, 525 to 530) | -1.29, 2.0 | (205, 500) | -1.27, 1.82 |
| | | | (207, 520) | -1.23, 1.43 |
| | | | (213, 540) | -1.12, 1.05 |
| | (191, 580) | -0.51, 0.33 | (224.9, 560) | -0.89, 0.67 |
| | (198.8, 585) | -0.26, 0.17 | (248.4, 580) | -0.44, 0.29 |
| Rudder heel on the sole piece | (203, 590) | -0.12, 0.0 | (262, 590) | -0.18, 0.10 |

The counter is two straight slopes with a knuckle, the upper one at about 45 deg. The rudder is a single plate with a curved after edge, greatest breadth about 1.27 m abaft the post at Z about 1.9 m (the rudder plan, not re-read at full size, gives 4 ft 1 in). The rudder head rises through a trunk to about 0.95 m above the quarter deck (0124: px y 368; the rudder plan writes '3\'-2" above wood deck'). Confidence: medium (the two sheets agree within 0.15 m).

Stem and forefoot (0124, fore face / underside of the stem bar):

| px (x, y) | X (m) | Z (m) |
|---|---|---|
| (1866, 335) stem head | 53.39 | 8.34 |
| (1865, 400) | 53.36 | 6.25 |
| (1864, 480) | 53.33 | 3.68 |
| (1863, 505) | 53.30 | 2.87 |
| (1860.1, 520) | 53.20 | 2.39 |
| (1856.7, 530) | 53.09 | 2.07 |
| (1850.7, 540) | 52.90 | 1.75 |
| (1842.8, 550) | 52.65 | 1.42 |
| (1830.3, 560) | 52.25 | 1.10 |
| (1820, 566) | 51.92 | 0.91 |
| (1790, 579) | 50.96 | 0.49 |
| (1750, 590) | 49.67 | 0.14 |
| (1713, 595.3) | 48.49 | -0.03 |
| (1680, 598) | 47.43 | -0.12 |
| (1644, 599) keel underside | 46.26 | -0.15 |

The stem is straight and within 0.1 m of vertical from Z 3 m to the head; the forefoot is a quarter-curve starting at about frame 84. Confidence: high.

## 3. After-end sheet (0134, 'Altered Arrangement at After End, T.S.S. No 171, Scale 1/4" = one foot', dated in pencil 23.6.96)

What it shows: an inboard profile from the taffrail to about frame 50 with frame numbers (deckhouse, skylight, mainmast, after hatch, engine skylight, galley, funnel casing and the after wall of the chart house); a 'Plan of Cabin Sole' (frames 1 to 20); a 'Plan of Watertight Flat' (frames 11 to 29); a 'Section at Bhd 11'; a 'Section at Bhd 20'; and a 1/2 in scale 'Section of Divisional Bulkhead in Trimming Tank'. On this June sheet the trimming tank bulkheads are at frames 11 and 20; the July corrected profile (0124) has them at 8 and 17, and ink notes on 0134 read 'Bhd 8 stiffened thus' and 'Bhd 8 & 17 stiffened thus'. The hull form is unaffected.

Both sections are complete (both sides drawn). Half-breadth is half the distance between the outer lines; Z is measured from the vertex of the section at 52.3 px/m. The vertex is taken as the base line; the profile on the same sheet puts the decks about 0.1 m higher than the sections do, so Z carries +/- 0.1 m.

### 3.1 Section at bulkhead 11 (frame 11, X 6.30 m)

The outer lines are very nearly straight from the keel to the top of the drawn part: a plain V with no bilge, half-breadth growing 0.88 per unit height near the keel and easing to 0.75 at the cabin sole.

| px y | 1026 | 1010 | 990 | 970 | 950 | 930 | 910 | 890 | 870 | 850 | 836 | 830 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m) | 0.08 | 0.35 | 0.70 | 1.04 | 1.38 | 1.71 | 2.03 | 2.35 | 2.65 | 2.95 | 3.15 | 3.19 |
| Z (m) | 0.10 | 0.40 | 0.78 | 1.17 | 1.55 | 1.93 | 2.31 | 2.70 | 3.08 | 3.46 | 3.73 | 3.84 |

Levels at the centreline: watertight flat Z 2.72; cabin sole Z 3.61; horizontal stiffener Z 1.55. The section is drawn only to just above the cabin sole (Z 3.9). Confidence: medium to high.

### 3.2 Section at bulkhead 20 (frame 20, X 11.33 m), full depth to the quarter deck

| px y | 1035 | 1025 | 1015 | 1005 | 995 | 985 | 975 | 965 | 950 | 935 | 920 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m) | 0.18 | 0.95 | 1.45 | 1.83 | 2.11 | 2.36 | 2.56 | 2.76 | 2.97 | 3.18 | 3.34 |
| Z (m) | 0.04 | 0.23 | 0.42 | 0.61 | 0.80 | 0.99 | 1.19 | 1.38 | 1.66 | 1.95 | 2.24 |

| px y | 895 | 880 | 860 | 845 | 830 | 815 | 800 | 785 | 770 | 755 | 745 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Y (m) | 3.56 | 3.65 | 3.74 | 3.79 | 3.83 | 3.85 | 3.86 | 3.87 | 3.87 | 3.86 | 3.85 |
| Z (m) | 2.72 | 3.00 | 3.38 | 3.67 | 3.96 | 4.24 | 4.53 | 4.82 | 5.11 | 5.39 | 5.58 |

Quarter deck at side Z about 5.66, at centre 5.86; cabin sole at centre 3.40; watertight flat 2.62. The side is vertical within 0.02 m from Z 4.2 to the deck; there is no tumblehome at this station. Rise of floor is steep (Y 0.95 at Z 0.23) with a soft bilge. Confidence: high for shape, medium for absolute Z.

### 3.3 Plan of cabin sole (0134), hull at cabin-sole level, Z about 3.4 to 3.7 m

| Frame | 1.26 | 1.50 | 1.99 | 2.51 | 2.99 | 3.51 | 4.48 | 5.01 | 5.49 | 6.50 | 6.98 | 7.50 | 8.48 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| X (m) | 0.86 | 0.99 | 1.26 | 1.55 | 1.82 | 2.11 | 2.66 | 2.95 | 3.22 | 3.78 | 4.05 | 4.34 | 4.89 |
| Y (m) | 0.29 | 0.36 | 0.56 | 0.84 | 1.08 | 1.32 | 1.68 | 1.84 | 1.97 | 2.22 | 2.32 | 2.42 | 2.59 |

| Frame | 9.48 | 10.49 | 12.47 | 12.99 | 13.48 | 14.48 | 15.49 | 16.49 | 17.50 | 18.51 | 19.51 | 19.79 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| X (m) | 5.45 | 6.01 | 7.12 | 7.41 | 7.68 | 8.24 | 8.81 | 9.37 | 9.93 | 10.50 | 11.05 | 11.21 |
| Y (m) | 2.75 | 2.90 | 3.13 | 3.18 | 3.22 | 3.32 | 3.42 | 3.48 | 3.53 | 3.60 | 3.68 | 3.69 |

The 0124 cabin sole outline (1.5) agrees within 0.1 m from frame 6 forward and is up to 0.19 m fuller aft of frame 4. Confidence: medium to high.

### 3.4 Small sections on sheet 0124 (frames 9, 17 and 89)

These are small sketches of the tank ends (each drawn one side only, to the flat above the tank). Base taken at the horizontal line under each; 31.1 px/m.

| Section | Y, Z pairs (m) |
|---|---|
| Frame 9 (X 5.18), port side, to the cabin sole | 0.11, 0.16 ; 0.40, 0.68 ; 0.76, 1.32 ; 0.96, 1.64 ; 1.17, 1.96 ; 1.39, 2.28 ; 1.64, 2.60 ; 1.90, 2.93 ; 2.20, 3.25 ; 2.53, 3.57 ; 2.63, 3.70 |
| Frame 17 (X 9.65), port side, to above the watertight flat | 0.28, 0.11 ; 0.68, 0.31 ; 1.25, 0.63 ; 1.70, 0.95 ; 2.08, 1.27 ; 2.38, 1.59 ; 2.63, 1.91 ; 2.88, 2.23 ; 3.05, 2.56 ; 3.19, 2.81 ; 3.30, 3.04 ; 3.42, 3.36 ; 3.51, 3.65 |
| Frame 89 (X 49.88), starboard side, to the fore peak tank top | 0.08, 0.55 ; 0.24, 0.80 ; 0.40, 1.13 ; 0.55, 1.45 ; 0.68, 1.77 ; 0.79, 2.09 ; 0.89, 2.41 ; 0.98, 2.73 ; 1.05, 3.05 ; 1.14, 3.44 |

Confidence: low to medium. The frame 9 sketch is about 0.3 m narrower at cabin-sole level than both cabin sole plans, and the frame 89 sketch puts the tank top 0.3 m lower than the profile does. Prefer 3.1 to 3.3 where they overlap. The frame 89 sketch is the only drawn section of the bow.

## 5. Midship section sheet (0125-a): written figures relevant to the exterior

| Subject | As written | Note |
|---|---|---|
| Title block | Length bet Perpendiculars 175\'-0" ; Breadth Moulded 28\'-0" ; Depth Moulded 14\'-6" ; 'To class at Lloyds + 100 A.1.' ; Scale 1/2 in = 1 Foot | |
| Sections drawn | Right half: through the bridge and engine and boiler casing. Left half: 'Section in way of Raised Qr Dk and Cabin Sole'. Far left: part 'Section Fored in way of Main and Lower Deck'. | The left half is not amidships: its greatest half-breadth scales 13.3 ft against 14.0 ft on the right. |
| Bulwark | 'Bulwarks 5/20' ; height '4\'-0"' ; 'Teak Rail 9 x 2 1/2' ; 'Rail angle 4 x 3 x 6/20' ; 'Alternate frames run up Bulwarks' ; '3"' lap on the sheer strake | bulwark plate stands on the outside of the sheer strake and leans in with the tumblehome |
| Frames | 'Frames 3 1/2 x 3 x 6/20 for 3/5 L to 5/20 at ends. Spaced 22" apart.' | |
| Deck planking | 'Main dk P.P. 4" x 3 1/2"' ; 'R.Q.Dk 4 x 3 1/2 P.P.' ; 'Bridge dk Y.P. 4 x 2 1/2' ; 'Fcsle dk P.P. 4 x 3' ; lower deck 'Deck 6 x 2 1/2 W.P.' ; cabin sole 'Deck sheathing 6 x 2 W.P.' | P.P. pitch pine, Y.P. yellow pine, W.P. white pine |
| Covering boards | 'Teak 9 x 3 1/2' at the main and quarter deck edges ; 'Teak 9 x 3' at the bridge deck edge ; 'T. 6 x 1' upstand at the quarter deck edge | |
| Round of beam | '8" round' on the bridge, main and quarter decks | |
| Mouldings | '3 x 1 1/2 solid' twice on the bridge side (deck edge and mid-height) ; a half-round is drawn at the quarter deck edge | these are the only rubbing strakes or mouldings dimensioned |
| Side plating letters | K '36 x 5/20' and J '45 x 5/20' (bridge side) ; H 'Sheerstrake 34 x 8/20 for 1/2 L to 6/20 ... Midship thickness to be maintained beyond buoy gangway' ; G '53 1/2 x 7/20 ... Doubled in way of buoy gangway' ; F '45 1/2 x 8/20' ; E '53 1/2 x 9/20' ; D '41 x 8/20' ; C '53 1/2 x 7/20' ; B '39 1/2 x 8/20' ; A '32 x 9/20' | strake widths in inches; clincher (in and out) laps |
| Bilge keel | 'Bilge Keel for 70 ft amidships. Bulb plt 8 x 9/20, Tee bar 6 x 4 x 9/20' | 21.3 m long, about X 16 to 37.3 if centred; stands about 0.2 to 0.3 m off the turn of the bilge as drawn |
| Keel, stem, post | 'Keel 6 x 2 7/8' ; 'Stem 6 x 2 7/8' ; 'Sternpost 6[1/2?] x 2 7/8' ; 'Rudder stock 5" Dia' ; 'Pintles 2 3/4 dia' | bar keel 6 in deep |
| Casing | 'E. & B. Casing' ; '18"' above the bridge deck | |
| Pillars | '2 7/8 dia' and '2 5/8 dia' | |
| Half-breadths scaled off the right half (36.9 px/ft) | bridge deck edge 12.9 ft (3.93 m) ; main deck at side 13.63 ft (4.15 m) ; greatest, at about the lower deck, 14.0 ft (4.27 m) | medium |

'Equipment' block, in full:

> 2 Bower Anchors each 16 1/2 cwt Stockless
> 1 [ditto] 14 [cwt Stockless]
> 1 Stream [ditto] 4 1/2 [cwt] ex stock
> 1 Kedge [ditto] 2 1/4 [cwt ex stock]
> 195 Fathoms 1 5/16" stud link chain cable
> 60 [ditto] 14/16" stream chain or 3 1/2" steel wire
> 75 [ditto] 8 1/2" Manilla Towline
> 90 [ditto] 6 1/2" [Manilla] Warp
> (bracketed against the anchors) 10 % over rule to Owners Requirements

'Numerals' block: 1/2 Breadth 14.00 ; Depth 15.18 ; 1/2 Girth 25.72 (incl. sheer) ; 1st No 54.90 ; 2nd No 54.9 x 173.87 = 9545 ; Equip No 10449 Letter (i) ; L/B = 6.21 ; L/D = 11.45.

'Rivetting' block: structural only (butt and strap riveting); nothing on appearance.

## 7. Survey report, second page (0119-b)

### 7.1 Re-read at 4x: Masts and Spars, Boats, Bulwarks and the lines between

| Line on the form | As written | Confidence |
|---|---|---|
| Lower masts, Fore | Material 'Steel' ; Total length '56-8 1/2' ; At Partners '15 1/2 . 6/20' ; Heel '12 1/2 . 5/20' ; Hounds blank ; Head '12 1/2 . 5/20' ; plates in round '2' ; seams 'Single' ; butts 'Treble above partners and double below' | high for lengths and diameters; the plate-thickness fractions are small and could be 5/20 or 6/20 |
| Lower masts, Main | ditto steel ; '49-10 1/2' ; At Partners '14 1/2 . 6/20' ; Heel '12 1/2 . 5/20' ; Head '11 1/2 . 5/20' ; '2' | high |
| In metres | fore mast 17.28 m long, 0.394 m at the partners, 0.318 m at heel and head ; main mast 15.20 m long, 0.368 m at the partners, 0.318 m at the heel, 0.292 m at the head | |
| Mizen ; Bowsprit | none (struck through) | high |
| Topmasts and remainder of spars | 'pine' ('Yards' is struck out on the form) | high |
| Rigging | Shrouds 'Steel wire 2 3/4' ; Stays 'Steel wire 2 3/4"' (circumference) | high |
| Boats | 'Four.' Nothing else: no type, length or stowage. | high |
| Pumps | '2 in peaks, 4 in holds, and 1 in boiler space' ; 'In peaks 3" & 1 1/2", after hold 4" & 2", and remainder 2 1/4" tail pipes to navy pump' | medium |
| Windlass ; Capstan | 'Clarke, Chapman & Co' ; capstan struck through (none) | high |
| Engine room skylights | 'Teak on iron coamings.' Deadlights: 'Teak shutters with strong glass panels.' | high |
| Coal bunker openings | 'Cast iron scuttles' ; lids 'Bayonet fixing' ; height above deck 'Nil.' (flush in the deck) | high |
| Scuppers and freeing ports | 'On each side, ford 2 scuppers, and 2 ports 28" x 25". Open bulwarks aft.' | medium: the two counts read as 2; the port size reads 28 x 25 |
| Ceiling | holds '2" white pine' ; 'tween decks '6 x 2 W. pine sparring' | high |
| Cargo hatchways | 'Of plates and angles.' Hatches 'Solid 2 1/2".' | high |
| No. 1 Hatch (Forward) | '9\'-2" x 8\'-0" x 12"' (2.79 x 2.44 m, 0.30 m coaming) | high |
| No. 2 Hatch | '7\'-4" x 7\'-0" x 12"' (2.24 x 2.13 m, 0.30 m coaming) | high |
| No. 3 and No. 4 Hatch | none (struck through). The small hatch abaft No. 1 on the plan is not counted as a cargo hatch. | high |
| Fore and afters | 'One fore and after to each.' | high |
| Breasthooks ; crutches | 'Four' ; 'Three' | high |
| Bulwarks, height above deck and description | '3\'-9". Steel plating 5/20".' (1.14 m) | high |
| Main rail | 'Teak 9" x 2 1/2".' | high |

The 3 ft 9 in bulwark and the 4 ft 0 in drawn on the midship section agree: the drawing dimensions from the deck beam at side, the report from the 3 1/2 in wood deck.

### 7.2 Other entries on the page, read at reduced size only

| Subject | As written | Confidence |
|---|---|---|
| Register particulars | 'R.Q.D. or Break 53 ft, Bridge Dk 51 1/2 ft, F\'castle 27 1/2 ft' ; 'The raised quarter deck is joined to the bridge' ; '2 Decks, 2 tiers of Beams' | high |
| Preservation | 'Inside By cement and paint. Outside By paint.' | high. This is the only statement about paint in the records read, and it names no colour. |
| Anchors | three bowers certified 16-2-4, 16-2-[?] and 14-[?]-12 cwt-qr-lb, 'Stockless', 'Smith\'s Patent' ; stream 4-2-[?] and kedge 2-1-[?], 'Ordinary' | low for the individual weights; the midship section's Equipment block gives the nominal 16 1/2, 16 1/2, 14, 4 1/2 and 2 1/4 cwt |
| Hawsers | towline hemp 75 fathoms 8 1/2 in ; hawser 90 fathoms 6 1/2 in ; warps | low |
| Water ballast | fore peak tank 18 ft, 17 tons ; deep tank aft 16 1/2 ft, 39 tons | medium |
| Class | '+ 100 A1 Steel, Well Deck' ; committee minute stamped 'FRI 11 DEC 1896' | high |

## Not read

- **Task 4, mast plan (0130):** not read.
- **Task 6, rudder plan (0128):** seen only at reduced size while calibrating. Figures glimpsed, all low confidence until re-read: 'Extreme length 23\'-8 1/2"', rudder stock 5 in diameter, 'Rudder plate 15/20" thick', head '3\'-2" above wood deck', after-edge ordinates at 2 ft 0 in spacing reading about 1\'-0 1/2", 2\'-1 1/2", 3\'-3", 3\'-10 3/4", 4\'-1", 3\'-8 1/4", 2\'-5 1/4".
- **Task 7:** the electric lighting report page 2 (0123-b), machinery report (0121), classing remarks (0118), the 1897 repair and machinery surveys (GLS178-0009, -0010), the lower third of the 1899 survey (GLS184-0123) and the plumber-work sheets (0132, 0133) were not read.
- **Rigging plan (0126):** not re-read.

## Colour and finish

No colour, paint scheme or surface finish is stated on any record read. The only relevant words are the survey report's 'Outside By paint' and the material notes above (teak rails and covering boards, pitch pine and yellow pine decks, teak engine skylights, teak companion).

---

# Pass 2: fittings, rigging leads and lights

Added 13 October 2026 for the close-up model. Sections 8 to 13 are new; sections 0 to 7 above are unchanged. The 'Not read' list above is superseded by section 14.

**All X and Z in sections 8 to 13 are model coordinates** (origin at rigging-plan px 228; model X = AP X - 0.21), read off `lr-0126-rigging-plan-1896-07-16-a.jpg` with px = 228 + 31.006 X, py = 998 - 31.006 Z unless another sheet is named. The rigging plan is a starboard elevation, so Y is not given: an item is 'centre' or 'side' only by inference. Pixel positions are quoted so each reading can be checked.

## 8. Rigging plan (0126-a), everything that is not hull outline

### 8.1 The three figures written on the sheet

| Where written | As written | Meaning | Confidence |
|---|---|---|---|
| Above the main truck | '2 3/4"' | rake of the mainmast, inches per foot: 12.9 deg (slope 0.229; scaled 0.22 to 0.23) | high |
| Above the fore truck | '2"' | rake of the foremast, inches per foot: 9.5 deg (slope 0.167; scaled 0.163 to 0.165) | high |
| Above the funnel | '2 3/8"' | rake of the funnel, inches per foot: 11.2 deg (slope 0.198; scaled 0.19) | high |

A pencil note is written along each topmast (near px 485, 440 and px 1430, 400), with an arrow to the lower masthead. It is not legible at this resolution.

### 8.2 Masts

| Item | px (x, y) | X | Z | Note | Confidence |
|---|---|---|---|---|---|
| Mainmast at the quarter deck | (581, 815) | 11.38 | 5.90 | | high |
| Main lower masthead: top of the steel mast, where the shrouds, mainstay and derrick topping lift meet | (499, 458) | 8.74 | 17.42 | mast plan: 39 ft 0 in from partners to hounds | high |
| Main topmast stay band | (456, 267) | 7.35 | 23.58 | 1.83 m (6 ft) below the truck | medium |
| Main truck | (442, 212) | 6.90 | 25.35 | topmast 8.14 m (26 ft 8 in) from the lower masthead to the truck, measured along the rake | medium |
| Foremast at the main deck | (1483, 846) | 40.47 | 4.90 | | high |
| Fore lower masthead | (1418.5, 455) | 38.40 | 17.51 | mast plan: 42 ft 6 in from partners to hounds | high |
| Fore topmast stay band | (1384, 259) | 37.28 | 23.83 | 1.83 m below the truck | medium |
| Fore truck | (1375, 203) | 36.99 | 25.64 | topmast 8.25 m (27 ft) above the lower masthead | medium |

Each mast is one straight line from deck to truck: a steel lower mast with a wooden pole topmast continuing in the same line ('Wooden Topmast' is written at the head of each on the mast plan). No crosstrees, cap, top, gaff, boom, yard or spencer mast is drawn on either mast. The only break in the line is the stay band at the lower masthead. No lightning conductor is drawn. Signal halyards cannot be separated from the sail seams at this resolution.

### 8.3 Standing rigging

| Item | Upper end | Lower end, px | X | Z | Confidence |
|---|---|---|---|---|---|
| Main shrouds, three a side | lower masthead (8.74, 17.42) | (521, 815), (535, 815), (549, 815) | 9.45, 9.90, 10.37 | about 5.9 (quarter deck edge) | medium: three lines are distinct at the deck; the aftermost is drawn heaviest and may be two lines |
| Fore shrouds, three a side | lower masthead (38.40, 17.51) | (1420, 812), (1436, 812), (1456, 812) | 38.44, 38.96, 39.60 | about 5.9 (bulwark rail) | medium, as above |
| Ratlines | | | | | **not drawn** on either mast. The plan cannot show their absence; the Ramsey plate should decide. |
| Mainstay | lower masthead (8.74, 17.42) | (957, 762) | **23.51** | **7.61** | medium. This is the after end of the boiler casing, just abaft the funnel, not the engine casing. |
| Main topmast stay | topmast band (7.35, 23.58) | about (956, 762), the same point | 23.5 | 7.6 | medium for the line (slope 0.99 through px 827, 635); medium to low for the exact landing |
| Forestay | lower masthead (38.40, 17.51) | stem head (1873, 756) | 53.05 | 7.80 | high |
| Fore topmast stay | topmast band (37.28, 23.83) | stem head (1873, 756) | 53.05 | 7.80 | high |
| Stay between the masts, or from a mast to the funnel | | | | | none drawn |
| Topmast backstays | | | | | not identifiable; none lands abaft the shrouds |

All shrouds lead aft of their mast; nothing lands forward of either mast except the stays.

### 8.4 Sails drawn (the verso is docketed 'Sail Plan')

| Sail | As drawn | Key points (X, Z) | Confidence |
|---|---|---|---|
| Main trysail | triangular, jib-headed, set abaft the mainmast with its head at the truck; cloths drawn parallel to the leech; loose-footed, no gaff and no boom | clew (322, 718) = 3.03, 9.03; sheet (a double line) down to about (270, 808) = 1.35, 6.13, abaft the deckhouse; foot runs to the mast at about Z 8.3 | medium |
| Main staysail | set on the mainstay, cloths horizontal | foot at about Z 8.4 (py 735 to 740) between px 590 and 900 | medium |
| Fore trysail | as the main | clew (1238, 762) = 32.57, 7.61, sheeted to the bridge front at about (1222, 795) | medium |
| Fore staysail | set on the forestay, cloths horizontal | foot at about Z 8.9 (py 722) from px 1540 to 1787; tack fitting at (1785, 712) with a pendant down to about (1832, 762) | medium |

These are steadying sails. A model at sea in January 1901 would normally show them furled or absent; nothing in the records says which.

### 8.5 Derricks

| Derrick | Heel, px | Heel X, Z | Head, px | Head X, Z | Length | Topping lift and runner | Confidence |
|---|---|---|---|---|---|---|---|
| Main (one), pointing forward | (574, 745), fore side of the mast | 11.16, 8.16 (2.2 m above the deck) | (686, 630) | 14.77, 11.87 | 5.2 m (17 ft) | dashed topping lift from the lower masthead to the derrick head; dotted runner hangs from the head block at px 680 (X 14.6) to the after hatch | medium |
| Fore, pointing aft | (1462, 779) | 39.80, 7.06 (2.2 m above the deck) | (1362, 683) | 36.57, 10.16 | 4.5 m (14 ft 8 in) | dashed topping lift from an eye on the after side of the mast at (1437, 608), Z 12.58; dotted runner from a block at (1365, 695) down to (1364, 832), X 36.64, into the fore hatch | medium |
| Fore, pointing forward (the buoy derrick) | (1480, 778) | 40.38, 7.10 | (1634, 623) | 45.35, 12.09 | 7.05 m (23 ft) | dashed topping lift from the lower masthead; block at (1628, 640); dotted runner hangs at px 1632 (X 45.3) to a hook at py 775 | medium |

All three are drawn topped up at about 45 degrees, not stowed. No guys are drawn. A solid white oval is drawn at each derrick heel (px 590, 748; 1455, 785; 1490, 780): the gooseneck fitting, or possibly a lamp; low confidence either way. A band with a short crossbar (a cleat band) is drawn below each heel: mainmast py 765 (Z 7.5), foremast py 800 (Z 6.4).

### 8.6 Flags and staffs

| Position | As drawn | Size and position | Confidence |
|---|---|---|---|
| Main truck | a long tapering pennant: a short rectangular hoist section, then a narrowing fly ending in a point; drawn in folds, no device | hoist at the truck (442, 212); fly to (350, 287): about 3.1 m long | medium |
| Fore truck | a rectangular flag hanging limp, with a smaller rectangle outlined inside it against the hoist (a canton or a panel; no device legible) | px 1333 to 1372, py 205 to 270: about 1.25 m by 2.1 m as hanging | medium |
| Ensign staff at the taffrail | a large flag hanging in folds; no device drawn | staff heel about (165, 800) = -2.03, 6.39; head (83, 679) = -4.68, 10.29; staff 4.7 m long, raked aft about 34 deg from the vertical; flag about 1.4 m in the hoist | medium |
| Jackstaff | none drawn. A short post with a cap stands at px 1828 to 1834, py 738 to 762 (X 51.7, top Z 8.39, about 0.8 m high), where the staysail tack pendant comes down. | | medium |

### 8.7 Funnel

| Item | px | X | Z | Note | Confidence |
|---|---|---|---|---|---|
| Top, centre | (961, 521); corners (930, 527) and (993, 516) | 23.64 | 15.38 | plain rim cut square to the raked axis; no cowl, hood or cap | high |
| Stay band | (972, 577) at the centre; three lugs visible at px 950, 972 and 993 | 24.00 | 13.58 | the only band drawn | high |
| Base on the boiler casing | (1012, 772) | 25.28 | 7.29 | | high |
| Diameter as drawn | 63 px horizontal at py 650 | | | **2.0 m**. The inboard profiles draw 1.69 m (0124) and 1.78 m (0134); the rigging plan is the outboard view and probably shows the outer casing. | medium |
| Stays | after stay from the lug at px 950 down to about (910, 795); forward stay from the lug at px 993 down to about (1105, 765); a third line from the middle lug runs nearly parallel to the funnel (a stay to the ship's side) | 22.0 / 28.3 | 6.5 / 7.5 | consistent with four stays, two a side; landing points low confidence | low to medium |
| Steam pipe, whistle, ladder | a second line is drawn close along the after side of the funnel from the casing to the stay band, which may be a waste steam pipe; no whistle or ladder is drawn | | | | low |

### 8.8 Boats and davits

| Item | px | X | Z | Confidence |
|---|---|---|---|---|
| Davit 1 (after boat, after davit), foot | 783, py 797 | 17.90 | 6.48 | high |
| Davit 2 (after boat, forward davit), foot | 956 | 23.48 | 6.48 | high |
| Davit 3 (forward boat, after davit), foot | 1011 | 25.25 | 6.48 | high |
| Davit 4 (forward boat, forward davit), foot | 1173 | 30.48 | 6.48 | high |
| Davit heads | py 722; px 762, 940, 1000, 1157 | 17.22, 22.96, 24.90, 29.96 | 8.90 | all four are radial davits with a flared foot on the bridge deck, 2.4 m high, heads turned **aft** by 0.5 to 0.7 m; a span is drawn between the two heads of each pair | high |
| After boat | px 745 to 967 | 16.7 to 23.8 | gunwale about 7.5 | about 7.2 m (24 ft); medium to low for the ends |
| Forward boat | px 992 to 1178 | 24.6 to 30.6 | gunwale about 7.5 | about 6.0 m (20 ft); medium to low |

The boats sit inboard on the bridge deck with their keels near deck level; the engine skylight shows above the after boat. Falls, chocks, gripes and covers are not drawn. The survey report says four boats, so the port side presumably repeats this. No boat boom, accommodation ladder or anchor davit is drawn.

### 8.9 Bridge and wheelhouse

| Item | px | X | Z | Note | Confidence |
|---|---|---|---|---|---|
| Wheelhouse side: five windows | px 1080 to 1172; py 738 to 760 | 27.48 to 30.45 | 7.68 to 8.39 | upright rectangular windows about 0.4 m wide by 0.7 m high in framed panels, with a panelled dado below; no door is drawn on the starboard side | high |
| Roof | py 725 to 730; forward overhang to px 1222 | to 32.06 | 8.7 to 8.8 | the box at px 1180 to 1222, py 722 to 734 is the roof overhang with its fascia | high |
| Roof instrument, forward | px 1184; base py 726, top py 692 | **30.83** | 8.8 to 9.87 | a pedestal with a rounded, hooded head: a binnacle (the standard compass) | medium |
| Roof instrument, after | px 1148; top py 694 | **29.67** | 8.8 to 9.80 | a tapering pedestal with a drum-shaped head and a short upright lever on its after side: reads as an engine telegraph seen from the side. It is not obviously a searchlight. | low to medium |
| Dotted line over the roof | py 700 to 703 from px 1076 to 1220; dotted uprights at px 1076, 1113 and 1219 | 27.35 to 32.0 | 9.55 | 0.85 m above the roof: a rail round the roof (an open upper bridge), or a low awning frame | medium |
| Panelled screen at the bridge front | px 1183 to 1218; py 765 to 795 | 30.80 to 31.93 | 6.55 to 7.51 | two framed panels, 0.97 m high, at the fore end of the bridge deck side: a wing screen or dodger | medium |
| Side-light screens | | | | not identifiable on the plan | |
| Bridge deck rails | py 778 to 790 along the boats, dotted stanchions | 13.6 to 31.8 | 6.7 to 7.1 | open rails, drawn dotted behind the boats | medium |

### 8.10 Lights drawn

| Item | px | X | Z | Confidence |
|---|---|---|---|---|
| Lantern on a bracket on the fore side of the foremast | (1420 to 1430, 420 to 430); bracket from the mast at (1410, 427) | 38.61 (0.37 m forward of the mast axis) | **18.48**, one metre above the lower masthead and the forestay | medium |
| Any other lantern, side light or stern light | | | | none identifiable |

### 8.11 Ventilators, deck machinery and small fittings

| Item | px | X | Z | Note | Confidence |
|---|---|---|---|---|---|
| Tall cowl ventilator forward of the funnel | px 1045 to 1062; base py 770, top py 703 | 26.35 to 26.90 | base 7.35 on the boiler casing top, top **9.51** | mouth faces forward; one is visible, so a port and starboard pair would coincide | high |
| Any other cowl | | | | none found on the forecastle, well deck, bridge deck or quarter deck in the tiles read | medium |
| **Winch on the quarter deck** | circle about 18 px across at (619, 805) | **12.6** | 5.9 to 6.5 | between the mainmast and the after hatch, on the '6/20' doubling plate of the deck plan (model X 11.99 to 13.12) | medium |
| **Winch on the well deck** | dotted circle about 20 px across at (1450, 838), dotted because it is behind the bulwark | **39.4** | centre 5.16 | between the fore hatch and the foremast, on the '5/20' plate of the deck plan (model X 38.6 to 39.4) | medium |
| Windlass | px 1675 to 1718; py 745 to 782 | **46.67 to 48.05** | about 1.05 m high above the forecastle deck | a large drum or gypsy about 0.85 m across at X 47.0, an upright at X 47.45 and a small wheel at X 47.8 on a bed plate. It sits exactly on the dashed square of the forecastle deck plan (section 1.3), which is therefore the windlass seat. | high |
| Anchor | px 1820 to 1850; py 795 to 830 | 51.3 to 52.3 | 5.4 to 6.5 | a stockless anchor housed in the hawse pipe, flukes outboard; hawse pipe centre about (51.8, 6.0) | high |
| Hand steering wheel at the stern | vertical spindle px 237, py 757 to 805, hub at py 787 | **0.29** | hub 6.8; rim 6.2 to 7.8 | a wheel about 1.5 m across seen edge-on, on the centreline just forward of the rudder head | medium |
| Low framed structure abaft it | px 162 to 232; py 775 to 805 | -2.13 to 0.13 | 6.2 to 7.2 | a rectangular frame on three turned legs over the rudder head: the steering gear cover, or a stern seat and grating | low for identity |
| Quarter deck rail | py 782 to 790 | 0 to 16 | top about 6.95 | open rail about 0.9 m high | high |
| After deckhouse details | door px 283 to 302, py 757 to 805; ports at px 316 and 372, py 765 | door 1.77 to 2.39; ports 2.84 and 4.64 | door 6.2 to 7.8; ports 7.5 | one door at the after end of the starboard side and two round ports | high |
| Small ridge skylight | px 525 to 560; py 795 to 815 | 9.6 to 10.7 | | as section 2.3 | high |
| Moulding on the counter | px 180 to 318; py 832 to 840 | -1.5 to 2.9 | 5.1 to 5.3 | a half-round running forward from the knuckle and ending in a knob | medium |
| Mouldings on the bow | py 772 to 778 from px 1640; py 800 to 808 from px 1740 | 45.5 to 53; 48.8 to 53 | about 7.2 and 6.3 | two half-rounds on the forecastle side | medium |
| Bell, galley funnel, stove pipes, bitts, fairleads, telegraph on the bridge deck | | | | none identifiable on the rigging plan | |

## 9. Mast plan (0130-a), 'T.S.S. No 171, Mast Plan, Scale 1/2 in = 1 ft'

Both masts are drawn lying down as plain tapered tubes. No fittings are drawn: no hounds band, cheeks, goosenecks, cleats or lamp bracket.

| Dimension | Foremast | Mainmast | Confidence |
|---|---|---|---|
| Length overall | '56\'-8 1/2"' (17.28 m) | '49\'-10 1/2"' (15.20 m) | high |
| Housing (heel to partners) | '14\'-2 1/2"' (4.33 m) | '10\'-10 1/2"' (3.31 m) | high |
| Partners to hounds | '42\'-6"' (12.95 m) | '39\'-0"' (11.89 m) | high |
| Diameter at the partners | '15 1/2' in (0.394 m) | '14 1/2' in (0.368 m) | high |
| Diameter at the heel | '12 1/2' in (0.318 m) | '12 1/2' in | medium (small figures; agree with the survey report) |
| Diameter at the head | 12 1/2 in per the survey report | 11 1/2 in per the survey report | figure on the drawing too small to read |
| Decks marked | 'Lower Deck' part way down the housing; 'Partners' at the main deck | 'Partners', labelled 'Main Deck' (it is the raised quarter deck on the profile) | high |
| Plating | '2 plates in the round'; 5/20 and 6/20; '6/20 doubling' from below the partners to about 12 ft above them, and again at the head | the same; doubling about 5 ft above the partners | not needed |
| Topmast | 'Wooden Topmast' written at the head; no length or diameter | 'Wooden Topmast' | high |

Notes on the sheet: 'Landings single rivetted. Butts below partners double rivetted, remainder treble [added in ink: with straps 1/20 thicker than plates]. All rivets 3/4 dia, & spaced 5 diars apart.'

Check: 42 ft 6 in up a mast raked 2 in per foot from the main deck at Z 4.9 puts the fore lower masthead at Z 17.66; the rigging plan scales 17.51. 39 ft 0 in at 2 3/4 in per foot from the quarter deck at Z 5.9 gives 17.49; the rigging plan scales 17.42.

## 10. Electric lighting report, page 2 (0123-b)

| Entry | As written | Confidence |
|---|---|---|
| Protection of cables exposed to weather | 'Cable for mast head light is only one exposed, which is lead covered and protected by galvanized wire armouring.' | high |
| Cables near galleys or oil lamps | 'None near oil lamps or other sources of heat' | medium |
| Near boiler casings; in the engine room | 'Teak wood casing' ; 'Teak wood casing' | high |
| Through beams; bulkheads; decks | 'Through hard wood' ; 'By watertight fittings' ; 'By brass tubes, lined with wood' | high |
| Through bunkers and cargo spaces | 'Yes' ; 'In bunkers by iron tube. In cargo spaces by wood casings.' No lamps in the bunkers or cargo spaces. | high |
| Cargo light cables | 'Portable' ; fixed 'By socket and plug' | high |
| Instruments | voltmeter and ammeter 'on Switch Board' | high |
| Copper; insulation | 98 per cent conductivity; 600 megohms per statute mile | high |
| Electrical engineers' signature | 'Lowdon Bros., Electrical Engineers', dated '3rd Decr 1896' | high for the date, medium for the spelling of the name |
| Compasses | standard compass 58 ft from the dynamo; steering compass 56 ft | high |
| Nearest cables | a cable carrying 3 amperes, 8 ft from the standard compass and 1 ft from the steering compass ; '**search light**' cable carrying 20 amperes, **7 ft from the standard compass and 10 ft from the steering compass** ; a cable carrying 6 amperes, 3 ft and 6 ft | high |
| Compasses adjusted with the installation at work | 'Not yet, but likely to be.' | high |
| Builder's signature | 'Gourlay Brothers & Co', 'Dec. 5th 1896' | high |
| General remarks | 'The Electric Lighting Installation has been fitted in general conformity with the requirements of the Rules.' Signed 'Jo. Thomson, Surveyor'. A London note dated 14.12.96 agrees. | high |

Nothing on this page states where the searchlight stands, who made it, or where individual lamps are. What it does establish: the masthead light was electric, on a single armoured cable up the mast; there were two compasses, a standard and a steering compass, about 2 ft different in distance from the dynamo; cargo lights were portable and plugged in; and the searchlight's cable comes no nearer than 7 ft (2.1 m) to the standard compass. The two instruments on the wheelhouse roof are 1.16 m (3 ft 10 in) apart on the rigging plan, so if the forward one is the standard compass the after one is not the searchlight.

## 11. Machinery report (0121-a), upper half of the first page only

| Entry | As written | Confidence |
|---|---|---|
| Heading | Report on Machinery No. 6204, Port of Dundee; first survey 'June 15th', last survey '3rd Dec 1896'; 32 visits; stamped received 'TUES 8 DEC 1896' | high |
| Ship | 'S.S. "Hesperus"'; master James Ewing; tons gross 584, net 189; registered horse power 140; 'Nom. Horse Power as per Section 28: 165.8' | high. This explains the 140 against 166 conflict: two different rules. |
| Engines | 'Twin screw Triple Expansion', 6 cylinders; diameters written '14, 23, 37' each over 2 (two sets); stroke 24 in; **130 revolutions per minute** | high. Settles the intermediate cylinder at 23 in. |
| Shafts | screw shaft 6.7 by rule, 7 1/4 fitted; tunnel shaft 6.36 by rule, 6 7/8 fitted; crank journals and pins 7 1/4; webs 11 1/2 x 5 | medium |
| **Propellers** | 'Diameter of screw 9\'-2"' (2.79 m) ; 'Pitch of screw 11\'-0"' (3.35 m) ; 'No. of blades 3' ; movable 'Yes' (blades bolted to the boss) ; 'Total surface 24 sq ft' ; 'twins' written beneath | high |
| Pumps | 2 feed pumps; 2 bilge pumps 2 3/4 in x 15 in stroke; 2 donkey engines; suctions listed include 'one 2 1/4" Gas tank compartment' and 'one 2 1/4" Tunnel well' | medium |

The lower half of this page and the whole of the second page (boilers, donkey boiler, remarks) were not read. Nothing in the part read mentions the funnel, steering gear, winches, windlass or whistle.

## 12. Gas tank sheet (0132) and plumber-work profile (0133-a)

### 12.1 'Sketch shewing Arrangement of Gas Tanks, T.S.S. No 171, Scale 1/8" = 1 Foot' (0132), stamped Gourlay Brothers 10/9/96 and Lloyd's Dundee office 11-9-96

Note written on the sheet, in full: **'Gas is carried at a pressure of 11 atmospheres in 5 circular iron Tanks having a total capacity of 1500 cubic feet.'** (high)

| Item | As drawn and labelled | Confidence |
|---|---|---|
| Upper tier | two tanks, each 'Gas Tank 10\'-0" x 6\'-0"' (3.05 m long, 1.83 m diameter), one each side in the 'tween deck, lying fore and aft | high |
| Between them, on the centreline | 'Compressing Engine' (dashed circle) under a 'Hatch' in the main deck | high |
| Lower tier | three tanks, each 'Gas Tank 10\'-0" x 6\'-6"' (3.05 m long, 1.98 m diameter), side by side in the hold | high |
| Compartment | between a 'Gas tight Bhd' at frame 58 and another at frame 64 (model X 32.36 to 35.72); 'Cross Bunker' abaft it, 'Fore \'Tween Decks' and 'Fore Hold' before it | high |
| The hatch over the compartment | the small hatch of the deck plan (model X 34.55 to 35.66) | high |

So the small hatch immediately abaft the fore cargo hatch is the gas-tank and compressor hatch. The sheet has a cross-section and a longitudinal section of this compartment; the cross-section is a second full section of the hull at about frame 61 and was not digitised.

### 12.2 'Plumber Work Plan, T.S.S. No 171, Scale 1/8" = 1 Foot. Under Deck Tonnage = 470 Tons Approx.' (0133-a)

A full-length inboard profile with the piping. Things it adds to the exterior or to the deck:

| Item | Where | Model X, Z | Confidence |
|---|---|---|---|
| After deckhouse is two rooms | 'Saloon Entrance' (after part) and 'State Room' (forward part) | division near X 4.1 | high |
| 'Skylight' | immediately forward of the deckhouse | as section 1.1 | high |
| 'Sanitary Tank' | at the top of the companion ('Comp') at the after end of the bridge deck; the companion is drawn 0.95 m high with a sloping top and a small gooseneck pipe at its upper forward corner; a 'Sanitary tank supply pipe' runs forward under the bridge deck | X 16.2 to 17.3; top Z about 7.5 | medium |
| 'Engine Skylight' | box on the engine casing, 1.15 m above the bridge deck | as section 2.3 | high |
| Galley skylight, ridge-roofed | between the engine skylight and the funnel | as section 2.3 | high |
| 'Boiler Casing' top | flat, about 0.4 m above the bridge deck, from the funnel to the chart house | | high |
| 'Chart House' and 'Steam Steering Gear' | as section 2.3; scuppers drawn from each | | high |
| **'4" Navy Pump'** | a hand pump with a flywheel about 0.45 m across on a pedestal, standing on the well deck immediately forward of the bridge front, wheel centre about 0.9 m above the deck | X about 32.3; Z about 5.6 | medium; profile only, so its distance off the centreline is unknown |
| Two hatches on the well deck | both labelled 'Hatch', with coamings | as section 1.4 | high |
| 'Crews Compan' | under the forecastle, with a 'Supply Tank to W.C.' under the forecastle deck beside it | X 45.3 to 46.9 | high |
| 'Fore peak air pipe, galvd iron' | rises from the fore peak to the forecastle deck close abaft the stem | X about 52.5 | medium |
| Hand pumps | '3" hand pump to aft peak' in the cabins; '3" hand pump from chain locker' in the crew space. Both below deck. | | medium |
| Baths | two baths drawn in the spaces beside the engine casing; 'Salt water lift force pump' and 'Fresh water pump' in the galley | below the bridge deck | medium |

The profile shows no tanks on the weather decks other than the sanitary tank, and no bollards, bitts, winches or windlass (it is a piping drawing).

## 13. Rudder plan (0128-a), written dimensions

| Dimension | As written | Confidence |
|---|---|---|
| Extreme length of rudder and stock | '23\'-8 1/2"' (7.23 m) | high |
| Rudder stock | '5" Diar' throughout | high |
| Rudder head | '3\'-2" above wood deck' (0.97 m above the quarter deck) | high |
| Rudder plate | 'Rudder plate 15/20" thick. Rivets 1" diar spaced about 6" centres. Holes 1 1/16" diar' ; 'Taper to edge of plate' | high |
| Breadth of the plate abaft the stock, at stations 2 ft 0 in apart from the top of the plate downward | '1\'-0 1/2"', '2\'-1 1/2"', '3\'-3"', '3\'-10 3/4"' (0.32, 0.65, 0.99, 1.19 m) | high |
| The remaining stations | 4\'-1", 3\'-8 1/4", 2\'-5 1/4" (1.24, 1.12, 0.74 m) | low: read only at reduced size in pass 1 |
| Rudder arms | '5 x 5' ; one arm '3\'-2 1/2"' long, rounded end, '6" rad' fillets | medium |
| Top of the plate below the stock taper | '2\'-8 3/4"' | medium |
| Pintles | spaced '3\'-6"' ; '2 3/4' dia in the detail ('Detail of Pintle, Scale 3" = one foot') ; 'Stopper' ; 'This recess made to allow nuts being lifted' | medium |

The greatest breadth, 4 ft 1 in (1.24 m), agrees with the 1.27 m scaled off the profiles in section 2.7.

## 14. Still unread after pass 2

- Machinery report: lower half of the first page and all of the second page (boilers, donkey boiler, general remarks).
- Classing remarks (0118), both 1897 Glasgow surveys (GLS178-0009, -0010) and the lower third of the 1899 survey (GLS184-0123).
- Electric lighting report page 1 was read by the lead, not here.
- On the rigging plan: the hull ports, the forecastle rail and anything smaller than about 0.15 m were not examined; the pencil note along each topmast is illegible in this scan.
- No record read in either pass states a colour.
