# Instrument craft pass

The room barometer, shaded thermometer and hand telescope now use meshes authored and exported through the connected Blender MCP. The existing printed faces, pressure pointer, Fahrenheit liquid column, weather timeline and telescope interaction remain in the game. The roof vane and Begbie signal lamp retain their existing models.

The barometer has a short mahogany backboard, turned brass bezel, hanging ring and slotted screws. The thermometer has a painted ventilated shelter, projecting weather cap and mounting clips. Its capillary is deliberately left optically open so the live red column is the only filled stroke beside the graduations. The telescope has stepped brass draw tubes, a leather grip, ferrules, a dark eyepiece and recessed optical faces. It sits 16 cm further inside the glazing on a narrow timber rest; its interaction position moves with it.

These forms, finishes, dimensions, shelter and timber rest are **reconstructions**. They do not establish the exact equipment kept at Flannan in 1901. The documentary basis for recording pressure, temperature and wind is described in [Weather observations](WEATHER-OBSERVATIONS.md). The models intentionally carry no invented maker attribution.

## Source and export

- `tools/props/instruments.blend` contains only the isolated instrument scene and its dependencies. The unrelated original open Blender scene was retained.
- `tools/props/instruments-mcp.py` creates the models in a new scene. `instruments-export-mcp.py` exports the active instrument scene and saves the standalone blend. Run their text with Blender MCP `execute_blender_code`, in that order, with the user's instrument request as `user_prompt`.
- `src/world/flannan/InstrumentModel.js` is the generated indexed mesh data in metres, Y up, with per-corner normals and physical UV coordinates. It contains no Blender review backdrop, lights, printed faces or preview readouts.
- `InstrumentCraft.js` assigns the existing engine materials. `Station.js` places the models in its existing batches and preserves the separately animated instrument parts.

The close-up meshes total **14,720 triangles**: barometer 3,080, thermometer 4,220, telescope 7,420. No model loader, additional texture download, transparent rendering pass or per-frame model update was introduced.

## Review evidence

`artifacts/instruments/blender/instruments-review.png` is a Blender studio render of the final models. Its pointer and liquid readouts are labelled review-only objects in the saved scene. The actual game renders use its existing live readings.

Run `node tools/shots/instruments.mjs after` for six native WebGPU views under `artifacts/instruments/after/`: barometer casing, its six/nine o'clock dial states, thermometer shelter and nine o'clock state, and the telescope on its sill. Matched original views are in `artifacts/instruments/before/`. The review route uses the weather preview and leaves the normal-watch save untouched.

Focused checks:

- `node test/instrument-model.mjs`: finite indexed export, unit normals, engine batches, mesh budget, telescope pickup dimensions and an open dial.
- `node test/weather-observations.mjs`: pressure/temperature, focus restoration, observation evidence and legacy compatibility.
- `node test/demo-story.mjs --weather-walk`: both observation rounds at walking speed while tending the lamp.
- `node test/keeper-duties.mjs` and `node test/signal-lamp.mjs`: adjoining apparatus, movement and existing study/save behavior.
- The native WebGPU review checks shader/validation errors and saves `verification.json` beside the images.

These checks and renders do not establish physical Quest/mobile performance, controller feel or user visual approval.
