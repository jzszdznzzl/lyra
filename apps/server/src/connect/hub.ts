import { currentPositionMs } from '@lyra/shared';
import type { ClientMessage, Device, PlaybackState, ServerMessage } from '@lyra/shared';

export interface ConnectSocket {
  id: string;
  send: (message: ServerMessage) => void;
}

interface Member {
  device: Device;
  socket: ConnectSocket;
  lastSeenAt: number;
}

interface Room {
  members: Map<string, Member>;
  activeDeviceId: string | null;
  state: PlaybackState | null;
}

/**
 * Spotify Connect–style rooms, one per user. Exactly one device plays (the active one); the
 * rest mirror its state and send commands that the hub forwards to it.
 */
export class ConnectHub {
  #rooms = new Map<string, Room>();
  #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  #room(userId: string) {
    let room = this.#rooms.get(userId);

    if (!room) {
      room = { members: new Map(), activeDeviceId: null, state: null };
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
      devices: [...room.members.values()].map(({ device, lastSeenAt }) => ({
        ...device,
        lastSeenAt,
      })),
      activeDeviceId: room.activeDeviceId,
      state: room.state,
      serverTime: this.#now(),
    };

    for (const member of room.members.values()) {
      member.socket.send(message);
    }
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

    if (room.activeDeviceId) {
      room.members.get(room.activeDeviceId)?.socket.send({ type: 'release' });
    }

    room.activeDeviceId = deviceId;
    room.state = state;
    target.socket.send({ type: 'takeover', state });
    this.#broadcast(room);
  }

  join(userId: string, socket: ConnectSocket, device: Device) {
    const room = this.#room(userId);
    const previous = room.members.get(device.id);

    // A reconnecting tab keeps its id; the stale socket is simply forgotten.
    if (previous && previous.socket.id !== socket.id) {
      room.members.delete(device.id);
    }

    room.members.set(device.id, { device, socket, lastSeenAt: this.#now() });
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
      room.activeDeviceId = null;
      room.state = this.#liveState(room, false);
    }

    if (room.members.size === 0 && !room.state) {
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

        // With nobody playing, the device that asked runs the command itself.
        (active ?? member).socket.send({ type: 'command', command: message.command });
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
