// @vitest-environment jsdom
// Preview contract: the request panel exposes fixtures and fires generation, and
// the first load shows the finished textured building with solid walls.

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { userEvent } from '@testing-library/user-event';
import { getByText } from '@testing-library/dom';
import { RequestPanel } from '../src/ui/widgets/RequestPanel.ts';
import { flatMaterialFor } from '../src/ui/views/flatMaterials.ts';
import { fetchSource } from '../src/materials/fetchSource.ts';
import { generate } from '../src/index.ts';

describe('RequestPanel', () => {
  it('lists fixtures and emits the selected request with a seed override', async () => {
    const onGenerate = vi.fn();
    const panel = new RequestPanel(
      { alpha: { seed: 'a', buildingId: 'x' }, beta: { seed: 'b', buildingId: 'y' } },
      { onGenerate },
    );
    document.body.appendChild(panel.root);

    const user = userEvent.setup();
    const select = panel.root.querySelector('select')!;
    expect([...select.options].map((o) => o.value)).toEqual(['alpha', 'beta']);

    await user.selectOptions(select, 'beta');
    expect(onGenerate).toHaveBeenCalledWith({ seed: 'b', buildingId: 'y' });

    await user.type(panel.root.querySelector('input')!, 'custom');
    await user.click(getByText(panel.root, 'generate'));
    expect(onGenerate).toHaveBeenLastCalledWith({ seed: 'custom', buildingId: 'y' });
  });
});

describe('preview textures', () => {
  it('generates a textured building from the served materials index', async () => {
    // jsdom serves import.meta.url over http, so box-relative paths go through cwd.
    const themeIndex = readFileSync(resolve('../materials/themes/cyberpunk/theme.json'), 'utf8');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toBe('/materials/themes/cyberpunk/theme.json');
      return { ok: true, json: async () => JSON.parse(themeIndex) };
    }));

    const source = await fetchSource('cyberpunk', '/materials/');
    expect(source).not.toBeNull();
    const request = JSON.parse(readFileSync(resolve('fixtures/residential-mid.request.json'), 'utf8'));
    const { textures } = await generate(request, {
      textures: { mode: 'external', baseUrl: '/materials/', source },
    });
    expect(textures.mode).toBe('external');
    vi.unstubAllGlobals();
  });

  it('keeps walls opaque in the flat inspection look, glass translucent', () => {
    const wall = flatMaterialFor('cyberpunk/wall/mid');
    expect(wall.transparent).toBe(false);
    expect(wall.opacity).toBe(1);
    expect(flatMaterialFor('cyberpunk/window-glass/mid').transparent).toBe(true);
  });
});
