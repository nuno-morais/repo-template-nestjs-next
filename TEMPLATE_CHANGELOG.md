# Template Changelog

## v2 — dependency modernization sweep

Major-version bump across the whole stack. Every bump was validated against
a real Copier-generated project: lint, type-check, unit tests, a real
PostgreSQL integration/e2e run, and both production builds — not just
peer-dependency resolution.

- **NestJS 11 → 12.** All `@nestjs/*` packages moved to v12, which ships
  ESM-first. Running the built app only needs Node 20.19+/22.12+ (Node's own
  `require(esm)` interop), but Jest's own `require()` cannot load these
  packages at all — confirmed empirically on Node 24.21, contradicting the
  optimistic framing of "just works on Node 24.9+" for this exact
  `ts-jest` combination.
- **Backend test runner: Jest → Vitest**, to resolve the NestJS 12 ESM
  problem the way NestJS's own docs recommend. Decorator metadata
  (`design:paramtypes`, required for DI and TypeORM's column-type
  inference) needs `unplugin-swc` with `decoratorMetadata: true` — Vite's
  default esbuild transform silently drops it. New root `vitest.config.ts`
  (unit) and `apps/api/test/vitest.config.e2e.ts` (integration, replacing
  `jest-e2e.json`). No test file needed source changes: none used
  `jest.fn`/`jest.mock`, only framework-agnostic `describe`/`it`/`expect`.
- **Node runtime: 22 → 24** in `Dockerfile`, CI, and a new `engines` field
  (`^22.12.0 || ^24.0.0 || >=26.0.0`) — chosen while diagnosing the Jest/ESM
  issue above. Once on Vitest, Node 22.12+ would technically suffice again
  (Vitest 5's own engines range), but 24 was kept for headroom since it was
  already validated end-to-end.
- **`nest-cli.json`: dropped the deprecated webpack builder.** NestJS 12
  no longer bundles webpack; the plain `tsc` build (no bundler at all) was
  already sufficient and is one dependency lighter. `ts-loader` removed.
- **TypeScript 5 → 6.0.3, not 7.** `@nestjs/swagger` and `ts-jest`-era
  tooling cap below TypeScript 7; `@typescript-eslint` caps below 6.1.0.
  6.0.3 is the only version satisfying every constraint at once.
  - TS6 requires an explicit `rootDir` (previously inferred) and rejects
    `baseUrl` without `ignoreDeprecations: "6.0"`.
  - TS6 stopped auto-including `@types/node`'s ambient globals for
    `ts-node`; added `"types": ["node"]` to the root `tsconfig.json`.
  - `strictPropertyInitialization` now triggers under `strictNullChecks`
    alone (previously needed full `strict: true`); explicitly set to
    `false` to preserve the original behavior for decorator-hydrated DTOs
    and TypeORM entities.
- **ESLint stays on 9.39.5, not 10.** `eslint-plugin-react`'s latest
  release still calls `context.getFilename()`, removed in ESLint 10;
  confirmed by a hard crash while linting `.tsx` files, not just a peer
  warning. `@typescript-eslint`, `eslint-config-prettier`, and
  `eslint-plugin-prettier` bumped to their current majors regardless.
- **`@clerk/backend` 1 → 3, `@clerk/testing` 1 → 2.** `verifyToken()` now
  throws on failure (previously an ergonomic path also returned a
  `{ data, errors }` shape); the guard's existing fallback unwrapping
  already tolerated this. More importantly, passing `authorizedParties`
  now makes Clerk itself require the token's `azp` claim to be present —
  removed that option from the guard's call, since the guard already
  enforces `azp` itself (via `OriginMatcher`) only when the claim exists,
  by design (mobile/native clients don't always stamp `azp`).
- **TypeORM 0.3 → 1.1.1**, the project's first stable major. No changes
  needed: the removed APIs (`Connection`/`createConnection`, MySQL/SQLite
  driver swaps, `findByIds`/`findOneById`) were never used here — this
  template was already on `DataSource` throughout.
- **Next.js 15 → 16, React → 19.3.** `middleware.ts` renamed to `proxy.ts`
  (Next 16 deprecates the old convention; the exported function stayed a
  default export, matching what Next 16 accepts unchanged).
- **Web tooling:** `@vitejs/plugin-react` capped at 5.2.0, not the latest
  6.1.1 — 6.x requires Vite 8 exclusively, 5.x also accepts Vite 7. Added
  Vite 7.3.6 as an explicit devDependency: Vitest 5 made it a required
  (non-optional) peer, where it was previously satisfied transitively.
  `@testing-library/*`, `eslint-plugin-react-hooks`, `jsdom` bumped to
  latest.
- **`@types/node` kept on `^22.x`**, not the newest major — it should
  track the Node runtime actually shipped in `Dockerfile`, not the
  bleeding edge of what the types package publishes.
- Trivial: `multer` resolution 2.3.0 → 2.4.0, `prettier`, `pg`, `express`,
  `class-validator`, `pino`/`pino-http`/`pino-pretty`, `dotenv`,
  `openapi-typescript` peer warning is cosmetic (doesn't bundle its own
  TypeScript, uses the project's).

## v1 — initial release


- NestJS 11 + Next.js 15 monorepo skeleton, generalized from `casamento-simples`.
- Clerk auth: JWT verification with generic org-claim extraction (no
  `Organization` entity or auto-provisioning).
- One example CRUD module (`widgets`) demonstrating the full module
  pattern: entity, migration, service, controller, DTOs, Swagger, unit
  test, API-integration test.
- API-contract generation (OpenAPI → TypeScript types consumed by the web
  app).
- Verify pipeline: lint, type-check, unit tests, API-integration test,
  Playwright e2e (via `@clerk/testing`), build, dependency audit.
- CI workflow mirroring the verify pipeline.
- `scripts/verify-template.sh` template self-check.
