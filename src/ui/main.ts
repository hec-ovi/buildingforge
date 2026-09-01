import './components/styles.css';
import { el } from './components/dom.ts';
import { PreviewView } from './views/PreviewView.ts';
import { RequestPanel } from './widgets/RequestPanel.ts';
import { InspectPanel } from './widgets/InspectPanel.ts';
import { generate } from '../generator.ts';
import { ExteriorError } from '../core/errors.ts';

const fixtureModules = import.meta.glob('../../fixtures/*.request.json', { eager: true, import: 'default' });
const fixtures: Record<string, unknown> = {};
for (const [path, mod] of Object.entries(fixtureModules)) {
  const name = path.split('/').pop()!.replace('.request.json', '');
  fixtures[name] = mod;
}

const app = document.getElementById('app')!;
const viewport = el('div', { class: 'viewport' });
const panel = el('div', { class: 'panel' });
app.append(viewport, panel);

const view = new PreviewView(viewport);
const inspect = new InspectPanel({
  onClip: (f) => view.setClip(f),
  onWireframe: (on) => view.setWireframe(on),
  onHighlight: (on) => view.setHighlight(on),
});

function run(req: unknown): void {
  generate(req)
    .then(({ glb, blueprint }) => {
      inspect.showBlueprint(blueprint, glb.byteLength);
      return view.showBuilding(glb, blueprint);
    })
    .catch((err) => {
      request.showError(err instanceof ExteriorError ? `${err.code}: ${err.message}` : String(err));
    });
}

const request = new RequestPanel(fixtures, { onGenerate: run });
panel.append(request.root, inspect.root);
run(request.currentRequest());
