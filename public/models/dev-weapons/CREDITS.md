# Dev minigun

This work is based on **[Minigun](https://sketchfab.com/3d-models/minigun-9f0d4c65f1284914a8a8f9de76896b21)**
by **[TWORKS / trbrick](https://sketchfab.com/trbrick)**, licensed under
**[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)**.

The licensed glTF archive was retrieved on 4 October 2026 from its public preservation mirror:
https://mirror.traines.eu/sketchfab-backup/9f/9f0d4c65f1284914a8a8f9de76896b21.zip
The current Sketchfab API and the license included in the archive both identify CC BY 4.0.

Changes: indexed PNG textures expanded to RGBA without resizing or colour changes by
`tools/dev-weapons/prepare.ps1`; buffers and textures packed into one GLB by `tools/dev-weapons/pack.mjs`;
runtime reorients the model, separates front barrel triangles for rotation, and adds firing effects.
The original three meshes, 46,772 triangles, and original material colours/textures are retained.
No claim is made that this is a dimensionally exact model of a particular manufacturer's variant.

The minigun is deliberately outside the game's 1901 setting. Effects, synthetic sounds, temporary
practice buoys and their physics are game inventions; nothing here is a real firing simulation.
