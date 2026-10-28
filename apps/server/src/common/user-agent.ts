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

function firstMatch(userAgent: string, table: [RegExp, string][]) {
  return table.find(([pattern]) => pattern.test(userAgent))?.[1];
}

/** Short human label such as "Chrome on Android"; good enough to tell sessions apart. */
export function describeUserAgent(userAgent: string) {
  const browser = firstMatch(userAgent, BROWSERS);
  const system = firstMatch(userAgent, SYSTEMS);

  if (browser && system) {
    return `${browser} on ${system}`;
  }

  return browser ?? system ?? 'Unknown device';
}
