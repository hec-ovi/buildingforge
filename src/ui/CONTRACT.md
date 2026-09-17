# CONTRACT: exterior preview

Version: 0.52.0.

Displays one generated exterior and exposes request and inspection controls.

## Input and entry

`src/ui/main.ts` mounts in `#app`, loads `fixtures/*.request.json` (`?fixture=name` selects one), calls Exterior with an HTTP material source, and renders the returned GLB and blueprint. Layout and labels load from [views/preview.json](views/preview.json); [FormSchema](components/Form.ts) supports select, text, range, toggle, buttons and display slots. Form receives choice lists and an action callback, and contains no architectural rules.

The preview watches source and fixtures; generated `out/` trees are excluded from file watching.

## Components and events

- `RequestPanel(fixtures, {onGenerate}, initialFixture?)`: renders fixture, seed, style and shape controls. `currentRequest()` returns a clone with its displayed seed. Selection, Enter and buttons emit `onGenerate(request)`. `showError(message)` displays inline text and a toast.
- `InspectPanel({onClip,onWireframe,onHighlight,onFlat,onView}, initialView?)`: emits fraction, Boolean and `orbit|eye|interior|corner|reference` settings. `showBlueprint(blueprint, glbBytes, textureMode)` displays statistics.
- `PreviewView(container)`: `showBuilding(glb, blueprint)` loads the matching output. `setClip`, `setWireframe`, `setHighlight`, `setFlat` and `setView` change presentation state.
- `ToastManager.show(message, {type?,durationMs?})`: displays an info, success, warning or error notification until close or timeout.

## Output and errors

Outputs a canvas, controls and statistics. Seed changes are visible and fixtures remain unchanged. Orbit uses measured GLB bounds; street eye is 1.7 m above the entrance approach. `?view=eye|interior|corner|reference` selects the initial camera. Interior eye is 1.7 m above the first upper floor, inside its room envelope and facing the authored corner. Corner detail stands 8 m outside that face. Reference street view looks upward from 1.7 m. The inspection sun casts the real shell shadows, with its shadow camera fitted to the model bounds. Controls use square corners. Display settings do not alter domain data.

Generation failures display Exterior's error code/message. Other generation or GLB-loading failures display `String(error)`. Failed catalog fetch supplies `null`; the returned texture status exposes keys fallback.

## Dependencies

[Exterior](../../CONTRACT.md) supplies [requests](../../schemas/building-request.schema.json), GLB and [blueprints](../../schemas/blueprint.schema.json). [Materials](../../../materials/CONTRACT.md) supplies catalogs/maps through the read-only preview route. Three.js supplies rendering and controls; the host supplies DOM, WebGL and ResizeObserver.
