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

  return {
    socket: { id, send: (message: ServerMessage) => inbox.push(message), close: () => {} },
    inbox,
  };
}

const last = (inbox: ServerMessage[], type: ServerMessage['type']) =>
  inbox.filter((message) => message.type === type).at(-1);

let now: number;
let hub: ConnectHub;
let pc: ReturnType<typeof fakeSocket>;
let phone: ReturnType<typeof fakeSocket>;

beforeEach(() => {
  now = 1_000_000;
  hub = new ConnectHub(() => now, 0);
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

  test('when the active device leaves for good, playback stops where it was', async () => {
    hub.handle('u', 's-pc', { type: 'state', state: state() });
    now += 2000;
    hub.leave('u', 's-pc');
    // Grace is 0 ms in these tests; the timer still runs on the next tick.
    await Bun.sleep(1);

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

describe('ConnectHub grace period', () => {
  test('a reloading active device gets playback back instead of others taking it', () => {
    const graceHub = new ConnectHub(() => now, 60_000);
    const pcBefore = fakeSocket('pc-1');
    const other = fakeSocket('phone-1');
    graceHub.join('u', pcBefore.socket, { id: 'device-pc', name: 'PC', kind: 'desktop' });
    graceHub.join('u', other.socket, { id: 'device-phone', name: 'Pixel', kind: 'mobile' });
    graceHub.handle('u', 'pc-1', { type: 'state', state: state() });

    graceHub.leave('u', 'pc-1');
    const away = last(other.inbox, 'sync');
    // Still listed, so the others can keep showing where the music plays.
    expect(away?.type === 'sync' ? away.devices.map((device) => device.id) : []).toContain(
      'device-pc',
    );
    expect(last(other.inbox, 'sync')).toMatchObject({
      activeDeviceId: 'device-pc',
      state: { isPlaying: true },
    });

    now += 3000;
    const pcAfter = fakeSocket('pc-2');
    graceHub.join('u', pcAfter.socket, { id: 'device-pc', name: 'PC', kind: 'desktop' });

    expect(last(pcAfter.inbox, 'takeover')).toMatchObject({
      state: { positionMs: 13_000, isPlaying: true },
    });
    expect(last(other.inbox, 'sync')).toMatchObject({ activeDeviceId: 'device-pc' });
  });
});

describe('ConnectHub commands while the active device is away', () => {
  test('the device that acts takes over instead of waiting for the grace period', () => {
    const graceHub = new ConnectHub(() => now, 60_000);
    const pc = fakeSocket('pc-1');
    const phone2 = fakeSocket('phone-1');
    graceHub.join('u', pc.socket, { id: 'device-pc', name: 'PC', kind: 'desktop' });
    graceHub.join('u', phone2.socket, { id: 'device-phone', name: 'Pixel', kind: 'mobile' });
    graceHub.handle('u', 'pc-1', { type: 'state', state: state() });
    graceHub.leave('u', 'pc-1');

    graceHub.handle('u', 'phone-1', { type: 'command', command: { type: 'play' } });

    expect(last(phone2.inbox, 'sync')).toMatchObject({
      activeDeviceId: null,
      state: { isPlaying: false },
    });
    expect(last(phone2.inbox, 'command')).toEqual({ type: 'command', command: { type: 'play' } });
  });
});

describe('kick', () => {
  test('closes every device of the user and forgets the room', () => {
    const closed: string[] = [];
    const socket = (id: string) => ({ id, send: () => {}, close: () => closed.push(id) });
    hub.join('u1', socket('a'), { id: 'device-aaaa', name: 'A', kind: 'desktop' });
    hub.join('u1', socket('b'), { id: 'device-bbbb', name: 'B', kind: 'mobile' });
    hub.join('u2', socket('c'), { id: 'device-cccc', name: 'C', kind: 'mobile' });

    hub.kick('u1');

    expect(closed.sort()).toEqual(['a', 'b']);
    expect(hub.activity('u1')).toBeNull();
  });
});

describe('sendTo', () => {
  test('reaches every device of that account and nobody else', () => {
    const other = fakeSocket('o');
    hub.join('u2', other.socket, { id: 'device-other', name: 'Other', kind: 'mobile' });

    hub.sendTo('u', { type: 'announcements' });

    expect(last(pc.inbox, 'announcements')).toBeDefined();
    expect(last(phone.inbox, 'announcements')).toBeDefined();
    expect(last(other.inbox, 'announcements')).toBeUndefined();
  });
});
