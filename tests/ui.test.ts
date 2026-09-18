// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { getByRole, getByText } from '@testing-library/dom';
import { RequestPanel } from '../src/ui/widgets/RequestPanel.ts';
import { InspectPanel } from '../src/ui/widgets/InspectPanel.ts';

afterEach(() => { document.body.replaceChildren(); });

it('renders JSON controls, emits the displayed request and shows generation errors', async () => {
  const fixture = { seed: 'a', buildingId: 'x', options: { windows: 'none' } };
  const before = structuredClone(fixture), onGenerate = vi.fn();
  const panel = new RequestPanel({ alpha: fixture, beta: { ...fixture, seed: 'b' } }, { onGenerate });
  document.body.append(panel.root);
  const user = userEvent.setup();
  await user.selectOptions(getByRole(panel.root, 'combobox', { name: 'Select fixture' }), 'beta');
  await user.selectOptions(getByRole(panel.root, 'combobox', { name: 'Exterior style' }), 'premium-mineral');
  await user.selectOptions(getByRole(panel.root, 'combobox', { name: 'Building shape' }), 'rounded-box');
  const seed = getByRole(panel.root, 'textbox', { name: 'Building generation seed' });
  await user.clear(seed); await user.type(seed, 'custom{Enter}');
  expect(onGenerate).toHaveBeenLastCalledWith({ seed: 'custom', buildingId: 'x', options: { windows: 'none', exteriorStyle: 'premium-mineral', shape: 'rounded-box' } });
  await user.click(getByText(panel.root, 'generate'));
  expect((panel.currentRequest() as { seed: string }).seed).toBe('custom');
  expect(fixture).toEqual(before);
  await user.click(getByText(panel.root, 'random seed'));
  const rolled = onGenerate.mock.calls.at(-1)![0].seed;
  expect(rolled).toMatch(/^[0-9a-f]{12}$/);
  expect((seed as HTMLInputElement).value).toBe(rolled);
  panel.showError('E_SCHEMA: seed required');
  expect(getByText(panel.root, 'E_SCHEMA: seed required')).toBeTruthy();
});

it('emits inspection settings from rendered controls', async () => {
  const events = { onClip: vi.fn(), onView: vi.fn(), onFlat: vi.fn(), onWireframe: vi.fn(), onHighlight: vi.fn() };
  const panel = new InspectPanel(events);
  document.body.append(panel.root);
  const user = userEvent.setup();
  await user.selectOptions(getByRole(panel.root, 'combobox'), 'eye');
  expect(events.onView).toHaveBeenCalledWith('eye');
  for (const [label, action] of [['flat colors', events.onFlat], ['wireframe', events.onWireframe], ['highlight openings', events.onHighlight]] as const) {
    await user.click(getByText(panel.root, label)); expect(action).toHaveBeenCalledWith(true);
  }
  const slider = getByRole(panel.root, 'slider') as HTMLInputElement;
  slider.value = '50'; slider.dispatchEvent(new Event('input'));
  expect(events.onClip).toHaveBeenCalledWith(0.5);
  expect(getByText(panel.root, '50%')).toBeTruthy();
});
