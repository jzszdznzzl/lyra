import { currentPositionMs } from '@lyra/shared';
import type { ClientMessage, Device, PlaybackState, ServerMessage } from '@lyra/shared';

export interface ConnectSocket {
  id: string;
  send: (message: ServerMessage) => void;
  close: () => void;
}

interface Member {
  device: Device;
  socket: ConnectSocket;
  lastSeenAt: number;
}

interface Room {
  userId: string;
  members: Map<string, Member>;
  activeDeviceId: string | null;
  state: PlaybackState | null;
  // Set while the active device is away (a reload, a dropped connection) and may come back.
  graceTimer: ReturnType<typeof setTimeout> | null;
  // The active device while away, still listed so others can show where music plays.
  away: Member | null;
}

/** What a user's room is playing, as of now, for anything outside Connect that shows it. */
export interface RoomActivity {
  state: PlaybackState;
  device: Device | null;
}

export type ActivityListener = (userId: string, activity: RoomActivity | null) => void;

// A reload takes a second or two; a phone switching networks a bit longer.
export const ACTIVE_GRACE_MS = 15_000;

/**
 * Spotify Connect–style rooms, one per user. Exactly one device plays (the active one); the
 * rest mirror its state and send commands that the hub forwards to it.
 */
export class ConnectHub {
  #rooms = new Map<string, Room>();
  #now: () => number;
  #graceMs: number;
  #onActivity: ActivityListener | null = null;

  constructor(now: () => number = Date.now, graceMs = ACTIVE_GRACE_MS) {
    this.#now = now;
    this.#graceMs = graceMs;
  }

  #room(userId: string) {
    let room = this.#rooms.get(userId);

    if (!room) {
      room = {
        userId,
        members: new Map(),
        activeDeviceId: null,
        state: null,
        graceTimer: null,
        away: null,
      };
      this.#rooms.set(userId, room);
    }

    return room;
  }

  #memberBySocket(room: Room, socketId: string) {
    return [...room.members.values()].find((member) => member.socket.id === socketId) ?? null;
  }

  #broadcast(room: Room) {
    const message: ServerMessage = {
      type: 'sync',
      devices: [...room.members.values(), ...(room.away ? [room.away] : [])].map(
        ({ device, lastSeenAt }) => ({
          ...device,
          lastSeenAt,
        }),
      ),
      activeDeviceId: room.activeDeviceId,
      state: room.state,
      serverTime: this.#now(),
    };

    for (const member of room.members.values()) {
      member.socket.send(message);
    }

    this.#onActivity?.(room.userId, this.#activity(room));
  }

  #activity(room: Room): RoomActivity | null {
    // A paused song keeps the time it stopped, which is when it was last heard.
    const state = room.state?.isPlaying ? this.#liveState(room, true) : room.state;

    if (!state) {
      return null;
    }

    const active = room.activeDeviceId
      ? (room.members.get(room.activeDeviceId) ?? room.away)
      : null;

    return { state, device: active?.device ?? null };
  }

  /** The state as of now, so a device taking over starts where the old one was. */
  #liveState(room: Room, isPlaying: boolean): PlaybackState | null {
    if (!room.state) {
      return null;
    }

    const now = this.#now();

    return {
      ...room.state,
      positionMs: currentPositionMs(room.state, now),
      updatedAt: now,
      isPlaying,
    };
  }

  #handleState(room: Room, member: Member, state: PlaybackState) {
    const isActive = room.activeDeviceId === member.device.id;

    // A paused device that is not in charge must not overwrite what another device plays.
    if (!isActive && !state.isPlaying) {
      return;
    }

    if (!isActive && room.activeDeviceId) {
      // Pressing play on another device moves playback there, as in Spotify.
      room.members.get(room.activeDeviceId)?.socket.send({ type: 'release' });
    }

    room.activeDeviceId = member.device.id;
    room.state = { ...state, updatedAt: this.#now() };
    this.#broadcast(room);
  }

  #handleTransfer(room: Room, deviceId: string, shouldPlay: boolean) {
    const target = room.members.get(deviceId);
    const state = this.#liveState(room, shouldPlay);

    if (!target || !state || room.activeDeviceId === deviceId) {
      return;
    }

    if (room.graceTimer) {
      clearTimeout(room.graceTimer);
      room.graceTimer = null;
      room.away = null;
    }

    if (room.activeDeviceId) {
      room.members.get(room.activeDeviceId)?.socket.send({ type: 'release' });
    }

    room.activeDeviceId = deviceId;
    room.state = state;
    target.socket.send({ type: 'takeover', state });
    this.#broadcast(room);
  }

  /** Called whenever a room changes: a new song, play, pause, a seek or another device. */
  onActivity(listener: ActivityListener) {
    this.#onActivity = listener;
  }

  activity(userId: string) {
    const room = this.#rooms.get(userId);

    return room ? this.#activity(room) : null;
  }

  /** How many accounts have at least one device connected right now. */
  onlineUsers() {
    return [...this.#rooms.values()].filter((room) => room.members.size > 0).length;
  }

  /** Sends `message` to every connected device of every account. */
  broadcastAll(message: ServerMessage) {
    for (const room of this.#rooms.values()) {
      for (const member of room.members.values()) {
        member.socket.send(message);
      }
    }
  }

  /** Disconnects every device of the user, e.g. when an admin suspends or deletes the account. */
  kick(userId: string) {
    const room = this.#rooms.get(userId);

    if (!room) {
      return;
    }

    if (room.graceTimer) {
      clearTimeout(room.graceTimer);
    }

    this.#rooms.delete(userId);

    for (const member of room.members.values()) {
      member.socket.close();
    }
  }

  join(userId: string, socket: ConnectSocket, device: Device) {
    const room = this.#room(userId);
    const previous = room.members.get(device.id);

    // A reconnecting tab keeps its id; the stale socket is simply forgotten.
    if (previous && previous.socket.id !== socket.id) {
      room.members.delete(device.id);
    }

    room.members.set(device.id, { device, socket, lastSeenAt: this.#now() });

    // The active device is back (e.g. after a reload): it carries on where it left.
    if (room.graceTimer && room.activeDeviceId === device.id) {
      clearTimeout(room.graceTimer);
      room.graceTimer = null;
      room.away = null;

      const state = this.#liveState(room, room.state?.isPlaying ?? false);

      if (state) {
        room.state = state;
        socket.send({ type: 'takeover', state });
      }
    }

    this.#broadcast(room);
  }

  leave(userId: string, socketId: string) {
    const room = this.#rooms.get(userId);
    const member = room ? this.#memberBySocket(room, socketId) : null;

    if (!room || !member) {
      return;
    }

    room.members.delete(member.device.id);

    if (room.activeDeviceId === member.device.id) {
      // Others keep showing it as the player for a moment instead of grabbing playback.
      room.away = member;
      room.graceTimer = setTimeout(() => {
        room.graceTimer = null;
        room.away = null;

        if (room.activeDeviceId === member.device.id && !room.members.has(member.device.id)) {
          room.activeDeviceId = null;
          room.state = this.#liveState(room, false);
          this.#broadcast(room);
        }
      }, this.#graceMs);
    }

    if (room.members.size === 0 && !room.state && !room.graceTimer) {
      this.#rooms.delete(userId);

      return;
    }

    this.#broadcast(room);
  }

  handle(userId: string, socketId: string, message: Exclude<ClientMessage, { type: 'hello' }>) {
    const room = this.#rooms.get(userId);
    const member = room ? this.#memberBySocket(room, socketId) : null;

    if (!room || !member) {
      return;
    }

    member.lastSeenAt = this.#now();

    switch (message.type) {
      case 'state': {
        this.#handleState(room, member, message.state);
        break;
      }
      case 'command': {
        const active = room.activeDeviceId ? room.members.get(room.activeDeviceId) : null;

        if (active) {
          active.socket.send({ type: 'command', command: message.command });
          break;
        }

        // The active device is gone (closed, or still reconnecting): someone acting now should
        // not wait for it, so the device that asked takes over from where playback was.
        if (room.graceTimer) {
          clearTimeout(room.graceTimer);
          room.graceTimer = null;
          room.away = null;
          room.activeDeviceId = null;
          room.state = this.#liveState(room, false);
          this.#broadcast(room);
        }

        // With nobody playing, the device that asked runs the command itself.
        member.socket.send({ type: 'command', command: message.command });
        break;
      }
      case 'transfer': {
        this.#handleTransfer(room, message.deviceId, message.shouldPlay);
        break;
      }
      default: {
        break;
      }
    }
  }
}
