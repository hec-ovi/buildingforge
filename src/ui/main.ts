import './components/styles.css';
import { el } from './components/dom.ts';
import { ToastManager, toast } from './components/Toast.ts';
import { PreviewView } from './views/PreviewView.ts';
import { RequestPanel } from './widgets/RequestPanel.ts';
import { InspectPanel } from './widgets/InspectPanel.ts';
import { generate } from '../generator.ts';
import { fetchSource } from '../materials/fetchSource.ts';
import { ExteriorError } from '../core/errors.ts';
import type { MaterialSource } from '../materials/theme.ts';

// vite.config.ts serves the materials box here, so the preview shows the
// finished textured building the generator ships.
const MATERIALS_BASE = '/materials/';

const fixtureModules = import.meta.glob('../../fixtures/*.request.json', { eager: true, import: 'default' });
const fixtures: Record<string, unknown> = {};
for (const [path, mod] of Object.entries(fixtureModules)) {
  const name = path.split('/').pop()!.replace('.request.json', '');
  fixtures[name] = mod;
}

const app = document.getElementById('app')!;
const viewport = el('div', { class: 'viewport' });
const panel = el('div', { class: 'panel' });

const hud = el(
  'div',
  { class: 'viewport-hud' },
  el('div', { class: 'hud-item' }, el('span', { class: 'hud-key' }, 'LMB'), 'Rotate'),
  el('div', { class: 'hud-item' }, el('span', { class: 'hud-key' }, 'Wheel'), 'Zoom'),
  el('div', { class: 'hud-item' }, el('span', { class: 'hud-key' }, 'RMB'), 'Pan'),
);
viewport.appendChild(hud);

app.append(viewport, panel, ToastManager.get().root);

const view = new PreviewView(viewport);
const inspect = new InspectPanel({
  onClip: (f) => view.setClip(f),
  onWireframe: (on) => view.setWireframe(on),
  onHighlight: (on) => view.setHighlight(on),
  onFlat: (on) => view.setFlat(on),
  onView: (mode) => view.setView(mode),
});

const sources = new Map<string, Promise<MaterialSource | null>>();
function themeSource(theme: string): Promise<MaterialSource | null> {
  let pending = sources.get(theme);
  if (!pending) {
    pending = fetchSource(theme, MATERIALS_BASE).catch(() => null);
    sources.set(theme, pending);
  }
  return pending;
}

async function run(req: unknown): Promise<void> {
  try {
    const theme = (req as { theme?: string }).theme ?? 'cyberpunk';
    const source = await themeSource(theme);
    const { glb, blueprint, textures } = await generate(req, {
      textures: { mode: 'external', baseUrl: MATERIALS_BASE, source },
    });
    inspect.showBlueprint(blueprint, glb.byteLength, textures.reason ?? textures.mode);
    await view.showBuilding(glb, blueprint);
    toast(
      `Building ${blueprint.buildingId}: ${blueprint.floors.length} floors (${(glb.byteLength / 1024).toFixed(0)} KiB)`,
      { type: 'success', durationMs: 2500 },
    );
  } catch (err) {
    request.showError(err instanceof ExteriorError ? `${err.code}: ${err.message}` : String(err));
  }
}

const request = new RequestPanel(fixtures, { onGenerate: (req) => void run(req) });
panel.append(request.root, inspect.root);
void run(request.currentRequest());
