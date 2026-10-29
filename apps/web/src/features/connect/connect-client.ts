import { ServerMessage, currentPositionMs } from '@lyra/shared';
import type { ClientMessage, Command, ListeningPreferences, PlaybackState } from '@lyra/shared';

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
// The server answers every hello with a sync; silence after this means the socket is dead.
const HELLO_TIMEOUT_MS = 4000;
// While another device plays it reports every few seconds; this much silence means we are cut off.
const MIRROR_SILENCE_MS = BEAT_MS * 3;

interface ConnectOptions {
  // An admin published or ended an announcement.
  onAnnouncements?: () => void;
  // Another device of the account saved its listening preferences.
  onPreferences?: (preferences: ListeningPreferences, updatedAt: number) => void;
}

/** Keeps this tab in the account's Connect room and bridges it to the player. */
export function startConnect({ onAnnouncements, onPreferences }: ConnectOptions = {}) {
  const device = thisDevice();
  let socket: WebSocket | null = null;
  let retryMs = RECONNECT_MIN_MS;
  let isStopped = false;
  let serverOffsetMs = 0;
  let reportTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let lastReported = { position: 0, at: 0 };
  let mirrored: PlaybackState | null = null;
  let lastMessageAt = Date.now();
  let helloTimer: ReturnType<typeof setTimeout> | null = null;

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
      case 'announcements': {
        onAnnouncements?.();
        break;
      }
      case 'preferences': {
        onPreferences?.(message.preferences, message.updatedAt);
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
    lastMessageAt = Date.now();

    ws.addEventListener('open', () => {
      retryMs = RECONNECT_MIN_MS;
      useConnectStore.setState({ isConnected: true });
      send({ type: 'hello', device });
      scheduleReport();
    });
    ws.addEventListener('message', (event) => {
      // A socket replaced after going silent may still deliver old messages; they are ignored.
      if (socket !== ws) {
        return;
      }

      lastMessageAt = Date.now();
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
      // A replaced socket closing late must not mark its successor as disconnected.
      if (socket !== ws) {
        return;
      }

      useConnectStore.setState({ isConnected: false });

      if (!isStopped) {
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

  /**
   * Android can keep a socket "open" after freezing the tab while nothing goes through it. It is
   * dropped for a fresh one instead of waiting for a close event that may never come.
   */
  function reconnectNow() {
    const stale = socket;
    socket = null;
    stale?.close();

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    retryMs = RECONNECT_MIN_MS;
    connect();
  }

  // The playing device reports every few seconds; in between, the bar keeps moving locally.
  const tick = setInterval(() => {
    const player = usePlayerStore.getState();

    if (!mirrored?.isPlaying || !player.remote) {
      return;
    }

    if (Date.now() - lastMessageAt > MIRROR_SILENCE_MS && socket?.readyState === WebSocket.OPEN) {
      reconnectNow();

      return;
    }

    // Without news of the next song, the bar waits at the end instead of running past it.
    const position = currentPositionMs(mirrored, serverNow()) / 1000;
    usePlayerStore.setState({
      position: player.duration > 0 ? Math.min(position, player.duration) : position,
    });
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
      const sentAt = Date.now();
      send({ type: 'hello', device });

      if (helloTimer) {
        clearTimeout(helloTimer);
      }

      helloTimer = setTimeout(() => {
        helloTimer = null;

        if (!isStopped && lastMessageAt < sentAt) {
          reconnectNow();
        }
      }, HELLO_TIMEOUT_MS);
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

    if (helloTimer) {
      clearTimeout(helloTimer);
    }

    isStopped = true;
    unsubscribe();
    clearInterval(beat);
    clearInterval(tick);
    socket?.close();
  };
}
