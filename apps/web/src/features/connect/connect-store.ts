import { create } from 'zustand';

import type { DeviceStatus } from '@lyra/shared';

interface ConnectState {
  selfId: string;
  devices: DeviceStatus[];
  activeDeviceId: string | null;
  isConnected: boolean;
  transfer: (deviceId: string) => void;
}

export const useConnectStore = create<ConnectState>()(() => ({
  selfId: '',
  devices: [],
  activeDeviceId: null,
  isConnected: false,
  transfer: () => undefined,
}));

export function activeDevice(state: Pick<ConnectState, 'devices' | 'activeDeviceId'>) {
  return state.devices.find((device) => device.id === state.activeDeviceId) ?? null;
}
