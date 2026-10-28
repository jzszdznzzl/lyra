import { beforeEach, describe, expect, test } from 'bun:test';

import type { PlaybackState, ServerMessage } from '@lyra/shared';

import { ConnectHub } from '../hub.ts';

const TRACK = {
  kind: 'song' as const,
  id: 'aaaaaaaaaaa',
  title: 'A',
  artists: [],
  album: null,
  durationSeconds: 200,
  thumbnail: null,
  isExplicit: false,
};

function state(patch: Partial<PlaybackState> = {}): PlaybackState {
  return {
    queue: [TRACK],
    index: 0,
    positionMs: 10_000,
    updatedAt: 0,
    isPlaying: true,
    volume: 0.8,
    repeat: 'off',
    isShuffled: false,
    ...patch,
  };
}

function fakeSocket(id: string) {
  const inbox: ServerMessage[] = [];

  return { socket: { id, send: (message: ServerMessage) => inbox.push(message) }, inbox };
}

const last = (inbox: ServerMessage[], type: ServerMessage['type']) =>
  inbox.filter((message) => message.type === type).at(-1);

let now: number;
let hub: ConnectHub;
let pc: ReturnType<typeof fakeSocket>;
let phone: ReturnType<typeof fakeSocket>;

beforeEach(() => {
  now = 1_000_000;
  hub = new ConnectHub(() => now);
  pc = fakeSocket('s-pc');
  phone = fakeSocket('s-phone');
  hub.join('u', pc.socket, { id: 'device-pc', name: 'PC', kind: 'desktop' });
  hub.join('u', phone.socket, { id: 'device-phone', name: 'Pixel', kind: 'mobile' });
});

describe('ConnectHub', () => {
  test('the device that starts playing becomes active and others see its state', () => {
    hub.handle('u', 's-pc', { type: 'state', state: state() });

    const sync = last(phone.inbox, 'sync');
    expect(sync).toMatchObject({ activeDeviceId: 'device-pc', state: { isPlaying: true } });
    expect(sync?.type === 'sync' ? sync.devices.map((device) => device.name) : []).toEqual([
      'PC',
      'Pixel',
    ]);
  });

  test('a paused device that is not active cannot overwrite the state', () => {
    hub.handle('u', 's-pc', { type: 'state', state: state() });
    hub.handle('u', 's-phone', {
      type: 'state',
      state: state({ isPlaying: false, index: 0, positionMs: 0 }),
    });

    expect(last(pc.inbox, 'sync')).toMatchObject({
      activeDeviceId: 'device-pc',
      state: { positionMs: 10_000 },
    });
  });

  test('remote commands reach the active device', () => {
    hub.handle('u', 's-pc', { type: 'state', state: state() });
    hub.handle('u', 's-phone', { type: 'command', command: { type: 'volume', volume: 0.3 } });

    expect(last(pc.inbox, 'command')).toEqual({
      type: 'command',
      command: { type: 'volume', volume: 0.3 },
    });
    expect(last(phone.inbox, 'command')).toBeUndefined();
  });

  test('"listen here" moves playback with the extrapolated position', () => {
    hub.handle('u', 's-pc', { type: 'state', state: state() });
    now += 5000;
    hub.handle('u', 's-phone', { type: 'transfer', deviceId: 'device-phone', shouldPlay: true });

    expect(last(pc.inbox, 'release')).toEqual({ type: 'release' });
    expect(last(phone.inbox, 'takeover')).toMatchObject({
      state: { positionMs: 15_000, isPlaying: true },
    });
    expect(last(pc.inbox, 'sync')).toMatchObject({ activeDeviceId: 'device-phone' });
  });

  test('pressing play on another device takes over and releases the old one', () => {
    hub.handle('u', 's-pc', { type: 'state', state: state() });
    hub.handle('u', 's-phone', { type: 'state', state: state({ positionMs: 0 }) });

    expect(last(pc.inbox, 'release')).toEqual({ type: 'release' });
    expect(last(pc.inbox, 'sync')).toMatchObject({ activeDeviceId: 'device-phone' });
  });

  test('when the active device leaves, playback stops where it was', () => {
    hub.handle('u', 's-pc', { type: 'state', state: state() });
    now += 2000;
    hub.leave('u', 's-pc');

    expect(last(phone.inbox, 'sync')).toMatchObject({
      activeDeviceId: null,
      state: { isPlaying: false, positionMs: 12_000 },
    });
  });

  test('commands with nobody playing go back to the sender', () => {
    hub.handle('u', 's-phone', { type: 'command', command: { type: 'play' } });

    expect(last(phone.inbox, 'command')).toEqual({ type: 'command', command: { type: 'play' } });
  });
});
