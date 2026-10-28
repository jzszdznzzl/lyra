import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts'],
  platform: 'node',
  format: 'esm',
  // Bun runs the output directly; `bun:*` modules exist only there.
  deps: { neverBundle: [/^bun:/] },
  clean: true,
  sourcemap: true,
});
