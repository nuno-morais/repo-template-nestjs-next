import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS decorator metadata (design:paramtypes) requires SWC's decoratorMetadata
// transform, not Vite's default esbuild, or DI silently resolves `undefined`.
// `root` must be an absolute path: a bare relative string resolves against
// Vitest's CWD, not this file's directory, and silently roots the scan at "/".
export default defineConfig({
  test: {
    include: ['**/*.e2e-spec.ts'],
    globals: true,
    root: resolve(import.meta.dirname, '../../..'),
    environment: 'node',
    testTimeout: 30000,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true, dynamicImport: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        keepClassNames: true,
      },
      module: { type: 'es6' },
    }),
  ],
});
