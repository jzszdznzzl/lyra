import { ServerMessage, currentPositionMs } from '@lyra/shared';
import type { ClientMessage, Command, PlaybackState } from '@lyra/shared';

import { PlaybackStatus, usePlayerStore } from '../player/player-store.ts';
import { useConnectStore } from './connect-store.ts';
import { thisDevice } from './device.ts';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15_000;
const BEAT_MS = 5000;
const REPORT_DEBOUNCE_MS = 150;
// A jump larger than this between reports is a seek, which others must hear about.
const SEEK_TOLERANCE_SECONDS = 1.5;
const REMOTE_TICK_MS = 500;

/** Keeps this tab in the account's Connect room and bridges it to the player. */
export function startConnect() {
  const device = thisDevice();
  let socket: WebSocket | null = null;
  let retryMs = RECONNECT_MIN_MS;
  let isStopped = false;
  let serverOffsetMs = 0;
  let reportTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let lastReported = { position: 0, at: 0 };
  let mirrored: PlaybackState | null = null;

  useConnectStore.setState({ selfId: device.id });

  const serverNow = () => Date.now() + serverOffsetMs;

  function send(message: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  const remote = { send: (command: Command) => send({ type: 'command', command }), volume: 1 };

  function isSelfActive() {
    return useConnectStore.getState().activeDeviceId === device.id;
  }

  function report() {
    reportTimer = null;
    const player = usePlayerStore.getState();

    if (player.remote || player.queue.length === 0) {
      return;
    }

    const state: PlaybackState = player.snapshot();

    // Only the active device, or one that just started playing, speaks for the room.
    if (!isSelfActive() && !state.isPlaying) {
      return;
    }

    lastReported = { position: player.position, at: Date.now() };
    send({ type: 'state', state });
  }

  function scheduleReport() {
    if (!reportTimer) {
      reportTimer = setTimeout(report, REPORT_DEBOUNCE_MS);
    }
  }

  function handle(message: ServerMessage) {
    const player = usePlayerStore.getState();

    switch (message.type) {
      case 'sync': {
        serverOffsetMs = message.serverTime - Date.now();
        useConnectStore.setState({
          devices: message.devices,
          activeDeviceId: message.activeDeviceId,
        });

        mirrored =
          message.activeDeviceId && message.activeDeviceId !== device.id ? message.state : null;

        if (message.activeDeviceId && message.activeDeviceId !== device.id) {
          player.mirror(message.state, remote, serverNow());
        } else if (
          !message.activeDeviceId &&
          message.state &&
          (player.remote || player.status === PlaybackStatus.Idle)
        ) {
          // Nobody plays: show where things stopped, ready to resume here.
          player.takeover({ ...message.state, isPlaying: false }, serverNow());
        } else if (!message.activeDeviceId) {
          player.setLocal();
        }

        break;
      }
      case 'command': {
        player.runCommand(message.command);
        break;
      }
      case 'takeover': {
        player.takeover(message.state, serverNow());
        break;
      }
      case 'release': {
        player.release();
        break;
      }
      default: {
        break;
      }
    }
  }

  function connect() {
    retryTimer = null;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/api/connect`);
    socket = ws;

    ws.addEventListener('open', () => {
      retryMs = RECONNECT_MIN_MS;
      useConnectStore.setState({ isConnected: true });
      send({ type: 'hello', device });
      scheduleReport();
    });
    ws.addEventListener('message', (event) => {
      let payload: unknown;

      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }

      const message = ServerMessage.safeParse(payload);

      if (message.success) {
        handle(message.data);
      }
    });
    ws.addEventListener('close', () => {
      useConnectStore.setState({ isConnected: false });

      if (!isStopped && socket === ws) {
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, RECONNECT_MAX_MS);
      }
    });
  }

  const unsubscribe = usePlayerStore.subscribe((next, previous) => {
    if (next.remote) {
      return;
    }

    const isPlaying = next.status === PlaybackStatus.Playing;
    const expected =
      lastReported.position + (isPlaying ? (Date.now() - lastReported.at) / 1000 : 0);
    const hasSeeked = Math.abs(next.position - expected) > SEEK_TOLERANCE_SECONDS;

    if (
      next.queue !== previous.queue ||
      next.index !== previous.index ||
      next.status !== previous.status ||
      next.repeat !== previous.repeat ||
      next.isShuffled !== previous.isShuffled ||
      next.settings.volume !== previous.settings.volume ||
      hasSeeked
    ) {
      scheduleReport();
    }
  });

  // The playing device reports every few seconds; in between, the bar keeps moving locally.
  const tick = setInterval(() => {
    if (mirrored?.isPlaying && usePlayerStore.getState().remote) {
      usePlayerStore.setState({ position: currentPositionMs(mirrored, serverNow()) / 1000 });
    }
  }, REMOTE_TICK_MS);

  const beat = setInterval(() => {
    if (isSelfActive() && usePlayerStore.getState().status === PlaybackStatus.Playing) {
      scheduleReport();
    }
  }, BEAT_MS);

  useConnectStore.setState({
    transfer: (deviceId) => send({ type: 'transfer', deviceId, shouldPlay: true }),
  });

  /**
   * Android freezes background tabs, so a socket can come back silent or dead. On return to the
   * foreground (or the network), reconnect at once or ask for a fresh sync.
   */
  function resync() {
    if (isStopped || document.visibilityState !== 'visible') {
      return;
    }

    if (socket?.readyState === WebSocket.OPEN) {
      send({ type: 'hello', device });
    } else if (socket?.readyState !== WebSocket.CONNECTING) {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      retryMs = RECONNECT_MIN_MS;
      connect();
    }
  }

  document.addEventListener('visibilitychange', resync);
  window.addEventListener('online', resync);
  window.addEventListener('pageshow', resync);

  connect();

  return () => {
    document.removeEventListener('visibilitychange', resync);
    window.removeEventListener('online', resync);
    window.removeEventListener('pageshow', resync);

    if (retryTimer) {
      clearTimeout(retryTimer);
    }

    isStopped = true;
    unsubscribe();
    clearInterval(beat);
    clearInterval(tick);
    socket?.close();
  };
}
