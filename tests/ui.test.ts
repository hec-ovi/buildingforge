// @vitest-environment jsdom
// Preview contract: the request panel exposes fixtures and fires generation.

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { getByText } from '@testing-library/dom';
import { RequestPanel } from '../src/ui/widgets/RequestPanel.ts';

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
