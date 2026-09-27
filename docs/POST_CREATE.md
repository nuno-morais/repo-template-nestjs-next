# Post-Create Checklist

Manual steps required after generating project with Copier.

## 1. Clerk Application

1. Create a Clerk application for this project (separate test and production instances).
2. Set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` in `.env`.
3. Add `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` as repository secrets in GitHub Actions.
4. Never share Clerk credentials across projects.

## 2. Clerk E2E Test User

1. Follow `e2e/README.md` to seed test user in Clerk **test** instance.
2. User email must use `+clerk_test@` address to allow automated verification bypass.
3. Configure `E2E_CLERK_USER_EMAIL` in `.env` if different from `e2e+clerk_test@example.com`.

## 3. CORS Origins

Update `CLIENT_ORIGINS` in `.env` to match permitted web origin(s) (comma-separated if multiple).

## 4. First Domain Module & Safe Migration Path

The `widgets` module (`apps/api/src/widgets/`, `apps/web/src/app/widgets/`, `apps/web/src/hooks/use-widgets.ts`, `apps/web/src/lib/api/widgets.ts`, `e2e/widgets.spec.ts`) provides reference CRUD architecture and can be replaced by your domain modules.

**Safe Migration Rules:**
Never delete an already applied migration file without handling database state. TypeORM records executed migrations in the `migrations` table; removing applied migration files corrupts migration tracking and breaks subsequent `yarn migration:run`.

Choose one of two safe paths:

- **Path A: Fresh Development Database (Clean Slate)**
  1. Revert applied migration:
     ```bash
     yarn migration:revert
     ```
     Or reset local Postgres volume:
     ```bash
     docker compose down -v
     ```
  2. Remove `apps/api/src/migrations/20260927120000-InitialSchema.ts`.
  3. Create your domain entities under `apps/api/src/entities/`.
  4. Generate new initial migration:
     ```bash
     yarn migration:generate apps/api/src/migrations/InitialSchema
     ```
  5. Run new migration:
     ```bash
     yarn migration:run
     ```

- **Path B: Existing or Shared Database (Continuous History)**
  1. Leave `20260927120000-InitialSchema.ts` in the repository.
  2. Remove widget entities and create a new forward migration dropping the table:
     ```bash
     yarn migration:generate apps/api/src/migrations/DropWidgets
     ```
  3. Run forward migration:
     ```bash
     yarn migration:run
     ```

## 5. Domain Architecture Documentation

Document project entities, relationships, and multi-tenancy rules in Section 4 ("Domain Model") of `docs/architecture/system-architecture.md`.

## 6. Deployment Pipeline

Configure deployment infrastructure for API and Web apps. Template deliberately excludes deployment tooling to avoid platform lock-in.
