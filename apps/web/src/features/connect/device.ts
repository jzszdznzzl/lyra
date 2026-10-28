import { DeviceKind } from '@lyra/shared';
import type { Device } from '@lyra/shared';

const DEVICE_KEY = 'lyra.device-id';

const BROWSERS: [RegExp, string][] = [
  [/EdgA?\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

function label(agent: string, table: [RegExp, string][]) {
  return table.find(([pattern]) => pattern.test(agent))?.[1];
}

/**
 * Each tab is its own device, like each Spotify app: the id lives in sessionStorage, so it
 * survives reloads but two tabs never share it.
 */
export function thisDevice(): Device {
  let id: string | null = null;

  try {
    id = sessionStorage.getItem(DEVICE_KEY);

    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(DEVICE_KEY, id);
    }
  } catch {
    id = crypto.randomUUID();
  }

  const agent = navigator.userAgent;
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
  const system = label(agent, SYSTEMS) ?? 'Device';
  const app = isInstalled ? 'Lyra app' : (label(agent, BROWSERS) ?? 'Browser');

  return {
    id,
    name: `${system} · ${app}`,
    kind: /Android|iPhone|iPad|Mobile/.test(agent) ? DeviceKind.Mobile : DeviceKind.Desktop,
  };
}
