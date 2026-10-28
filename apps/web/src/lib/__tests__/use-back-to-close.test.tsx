import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useBackToClose } from '../use-back-to-close.ts';

function Overlay({ name, onClose }: { name: string; onClose: () => void }) {
  useBackToClose(true, onClose);

  return <p>{name}</p>;
}

/** A player with a dialog that swaps itself for a second one, like "new playlist". */
function Player({ onPlayerClosed }: { onPlayerClosed: () => void }) {
  const [step, setStep] = useState<'list' | 'create' | 'none'>('list');

  return (
    <>
      <Overlay name="player" onClose={onPlayerClosed} />
      {step === 'list' ? <Overlay name="list" onClose={() => setStep('none')} /> : null}
      {step === 'create' ? <Overlay name="create" onClose={() => setStep('none')} /> : null}
      <button type="button" onClick={() => setStep('create')}>
        swap
      </button>
      <button type="button" onClick={() => setStep('none')}>
        done
      </button>
    </>
  );
}

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

afterEach(() => {
  history.replaceState(null, '');
});

describe('useBackToClose', () => {
  test('swapping one dialog for another keeps the overlay below open', async () => {
    const onPlayerClosed = vi.fn();
    const startLength = history.length;
    const view = render(<Player onPlayerClosed={onPlayerClosed} />);
    await tick();
    expect(history.length).toBe(startLength + 2);

    act(() => view.getByText('swap').click());
    await tick();
    // The swapped dialog took over the list's entry instead of stacking a new one.
    expect(history.length).toBe(startLength + 2);

    act(() => view.getByText('done').click());
    await tick();
    expect(onPlayerClosed).not.toHaveBeenCalled();
    view.unmount();
  });
});
