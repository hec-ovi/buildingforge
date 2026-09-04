// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { getByRole } from '@testing-library/dom';
import { userEvent } from '@testing-library/user-event';
import styleManifest from '../../../../materials/bindings/exterior-styles.json' with { type: 'json' };
import { RequestPanel } from './RequestPanel.ts';

afterEach(() => document.body.replaceChildren());

it('emits style and shape selections without changing fixtures or their other options', async () => {
  const fixtures = {
    alpha: { seed: 'review', options: { balconies: 'off' } },
    beta: { seed: 'other', options: { exteriorStyle: 'premium-office', shape: 'box' } },
  };
  const saved = structuredClone(fixtures);
  const onGenerate = vi.fn();
  const panel = new RequestPanel(fixtures, { onGenerate });
  document.body.append(panel.root);
  const user = userEvent.setup();
  const style = getByRole(panel.root, 'combobox', { name: 'Exterior style' }) as HTMLSelectElement;
  const shape = getByRole(panel.root, 'combobox', { name: 'Building shape' });
  expect([...style.options].map(option => option.value)).toEqual(['auto', ...styleManifest.styles.map(item => item.id)]);

  await user.selectOptions(style, 'premium-office');
  await user.selectOptions(shape, 'rounded-box');
  expect(onGenerate).toHaveBeenLastCalledWith({
    seed: 'review', options: { balconies: 'off', exteriorStyle: 'premium-office', shape: 'rounded-box' },
  });
  await user.selectOptions(style, 'auto');
  await user.selectOptions(shape, 'auto');
  expect(onGenerate).toHaveBeenLastCalledWith(fixtures.alpha);

  await user.selectOptions(getByRole(panel.root, 'combobox', { name: 'Select fixture' }), 'beta');
  expect(onGenerate).toHaveBeenLastCalledWith(fixtures.beta);
  expect(style.value).toBe('premium-office');
  expect((shape as HTMLSelectElement).value).toBe('box');
  expect(fixtures).toEqual(saved);
});
