# CONTRACT: exterior preview

Purpose: renders one generated exterior in a browser and exposes fixture, seed, camera, clipping and inspection controls.

Status: v0.46.5, implemented.

## Entry

`src/ui/main.ts` mounts into `#app`, loads `fixtures/*.request.json`, fetches `/materials/themes/<theme>/theme.json`, calls the root `generate` entry with an HTTP material source, and renders the returned GLB and blueprint together.

## Inputs and components

- `RequestPanel(fixtures: Record<string, unknown>, { onGenerate(request: unknown): void })`: takes a non-empty fixture record. `currentRequest(): unknown` returns a cloned selected request with a non-empty seed. `showError(message: string): void` renders the message inline and in an error toast.
- `InspectPanel({ onClip(number), onWireframe(boolean), onHighlight(boolean), onFlat(boolean), onView("orbit" | "eye") })`: owns inspection controls. `showBlueprint(blueprint: Blueprint, glbBytes: number, textureMode: string): void` renders building, geometry and material statistics.
- `PreviewView(container: HTMLElement)`: owns the Three.js canvas. `showBuilding(glb: Uint8Array, blueprint: Blueprint): Promise<void>` displays a matching output pair, derives opening highlights, measures the clip height and frames the camera. `setClip(fraction: number)`, `setWireframe(on: boolean)`, `setHighlight(on: boolean)`, `setFlat(on: boolean)`, and `setView("orbit" | "eye")` update presentation state.
- `ToastManager.show(message: string, { type?, durationMs? }): HTMLElement`: renders an `info | success | warning | error` notification.

## Outputs

The page outputs a WebGL canvas, request and inspection controls, blueprint statistics, success toasts and inline error text. It emits no domain data and does not modify the GLB or blueprint.

## Events

- Fixture change, Enter, `generate`, and `random seed` emit `onGenerate(request)`.
- The clip slider emits fractions from 0 to 1. The three display toggles emit Booleans. The camera selector emits `orbit | eye`.
- Pointer, wheel and right-button gestures drive `OrbitControls`. A toast closes from its button or timeout.

## Errors

No error escapes the page generation boundary. The rendered error set is:

- `ExteriorError`: the root contract's closed code and message.
- Preview error: `String(error)` for any other rejection from generation or GLB loading.

A failed theme fetch supplies `null`, so the generator reports its normal keys fallback.

## Invariants

- Presentation code calls the root generator and contains no building rules.
- The initial browser module graph contains no Node filesystem adapter. Core-fit constants come from Interior's published JSON schema through a static data import.
- Requests are cloned before the seed is applied; fixtures remain unchanged.
- The seed field always shows the seed sent to generation.
- A theme fetch is cached once per theme. Generated GLB and blueprint values always come from the same call.
- Orbit frames the measured GLB bounds. Street eye stands 1.7 m above the pavement in front of the main entrance.
- Clip height uses the measured GLB top. Flat, wireframe and highlight controls change only the rendered view. Flat glass is neutral smoke and translucent; flat curtain fabric remains visible from both room and street sides.
- Controls and notifications use square corners.

## Dependencies

- [Exterior contract](../../CONTRACT.md): request, GLB, blueprint and closed generation errors.
- [Materials contract](../../../materials/CONTRACT.md): theme index and maps served read-only at `/materials`.
- Three.js `WebGLRenderer`, `GLTFLoader` and `OrbitControls`.
- Browser DOM, WebGL, `ResizeObserver`, and Vite fixture and material routing.
