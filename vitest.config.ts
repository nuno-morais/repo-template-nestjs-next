import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS decorator metadata (design:paramtypes) requires SWC's decoratorMetadata
// transform, not Vite's default esbuild, or DI silently resolves `undefined`.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['apps/api/src/**/*.spec.ts'],
    environment: 'node',
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
  resolve: {
    alias: {
      src: resolve(__dirname, './apps/api/src'),
    },
  },
});
