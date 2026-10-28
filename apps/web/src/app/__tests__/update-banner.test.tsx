import { render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { UpdateBanner } from '../update-banner.tsx';
import { useUpdateStore } from '../updates.ts';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => Promise.resolve() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

afterEach(() => {
  useUpdateStore.setState({ isReady: false });
});

describe('UpdateBanner', () => {
  test('appears only while a new version waits', () => {
    const view = render(<UpdateBanner />);
    expect(view.queryByRole('status')).toBeNull();

    useUpdateStore.setState({ isReady: true });
    view.rerender(<UpdateBanner />);
    expect(view.getByRole('button', { name: 'app.update.apply' })).toBeTruthy();
  });
});
