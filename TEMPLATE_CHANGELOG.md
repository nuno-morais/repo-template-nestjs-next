# Template Changelog

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
