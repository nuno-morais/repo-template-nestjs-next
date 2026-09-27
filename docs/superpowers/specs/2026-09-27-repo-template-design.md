# Repo Template (NestJS + Next.js) — Design

## 1. Problem & Goals

Every new B2B SaaS project (API + web) restarts the same decisions: NestJS
module layout, Next.js app setup, Postgres/TypeORM wiring, Clerk auth,
Pino logging, Swagger/OpenAPI contract generation, CORS/Helmet hardening,
lint/test/build/verify scripts, CI. `casamento-simples` already embodies a
mature version of these decisions; `contract-guard` reimplements most of
them independently (and diverges — e.g. React/Vite web, different ports).

**Goal:** creating a new repo with these characteristics should start from
a working, opinionated skeleton instead of re-deriving conventions or
copy-pasting from a prior project by hand.

**Secondary goal (not solved by this spec alone):** reduce duplicated
maintenance across repos over time. This spec does not create a shared
runtime package — see [Non-Goals](#4-non-goals) — but does put in place
the mechanism (Copier) needed to propagate later fixes without one.

**Success criteria:**
- Running the template generator produces a repo that installs, runs
  locally (`docker compose up`), and passes its own verify suite
  (lint, type-check, unit tests, one e2e test) with zero manual code
  changes beyond answering the generator's prompts and creating a Clerk
  test application.
- A bugfix made in the template repo can be pulled into an already
  generated repo via `copier update`, without wiping that repo's
  business code.

## 2. Scope

**In scope:** one Copier template repository
(`github.com/nuno-morais/repo-template-nestjs-next`) producing an
API + web monorepo, structurally equivalent to `casamento-simples`
minus its wedding-planning domain.

**Baseline source:** `casamento-simples`, because it is the more mature
of the two reference repos (production hardening, migrations, CI gates,
API-contract generation, structured logging already in place).

**Out of scope for this spec:** any shared runtime/library package
consumed by multiple generated repos. See [Non-Goals](#4-non-goals).

## 3. What the Template Contains

Copied and generalized from `casamento-simples`, with all wedding-domain
modules removed:

- **Monorepo layout:** Yarn workspaces, `apps/api` (NestJS 11) and
  `apps/web` (Next.js 15, App Router, React 19, Tailwind, shadcn/ui,
  TanStack Query).
- **API skeleton:** `main.ts` bootstrap, `configure-app.ts` (Helmet,
  global `ValidationPipe`, CORS via `OriginMatcher`), Pino structured
  logging (`nestjs-pino`), Swagger setup at `/docs`, global exception
  filter, `/v1` prefix, health check endpoint, `common/` (decorators,
  DTOs, exceptions).
- **Auth:** Clerk JWT guard (`ClerkAuthGuard`), `@CurrentUser()` /
  `@CurrentOrg()` / `@Public()` decorators — kept as-is; Clerk is a
  fixed platform choice, not a per-project variable.
- **Persistence:** TypeORM + PostgreSQL, `ormconfig.ts`, manual
  migrations folder with one example migration, `docker-compose.yml`
  for local Postgres.
- **One example domain module, `widgets`** (deliberately generic, not
  borrowed from either reference project's real domain): a thin CRUD
  resource (`create`, `list`, `get`) kept only as a working reference
  for the module pattern (`*.controller.ts` / `*.service.ts` /
  `*.module.ts` / `*.swagger.ts` / DTOs / `*.spec.ts`) documented in
  section 3.2 of `system-architecture.md`. Deleted once the generated
  project has its own first real module — this is explicit in the
  post-create checklist.
- **API-contract generation:** `scripts/generate-api-contract.ts`
  producing `apps/web/src/types/api-contract.ts` from the OpenAPI spec,
  plus the `verify:api-contract` drift check.
- **Verification pipeline:** `scripts/verify.sh` and the underlying
  `yarn verify:*` scripts (lint, type-check api/web, unit tests
  api/web, api-integration test, e2e, build api/web, dependency audit).
  Deployment-shipping scripts (image publishing, backup/restore,
  credential recovery, load testing) are **not** copied — they encode
  `casamento-simples`'s specific production infrastructure and would be
  dead weight in a fresh repo; the verify pipeline stays generic
  (lint/type/test/build/e2e) so it's true on day one.
- **CI:** one GitHub Actions workflow equivalent to `images.yml`
  (`verified-images` quality gate: lint, api-contract check, type-check,
  unit tests, build, dependency audit, api-integration test — self-hosted
  runner). `deploy-dev.yml`, `deploy-prd.yml`, and `sync-dashboards.yml`
  are **not** copied — they target `casamento-simples`'s specific hosting
  and monitoring setup.
- **Docs:** `README.md` (tech stack table, local dev instructions),
  `docs/architecture/system-architecture.md` template (monorepo
  structure, domain module pattern, API design standards sections,
  domain-specific sections removed/marked as project-specific
  placeholders to fill in), `AGENTS.md` (language rule, working rules,
  git push rule — same as other repos).

## 4. Non-Goals

- **No shared runtime package.** Extracting common code (e.g. the
  Clerk guard, `configure-app.ts`, exception filter) into an installable
  package is deferred until a piece of code has proven stable and
  identical across at least two real generated repos. Doing it now would
  mean guessing at an API surface with a single consumer.
- **No enforced web framework beyond this template.** This template
  standardizes on Next.js because that's the `casamento-simples`
  baseline. It does not retrofit `contract-guard`'s Vite setup, and does
  not attempt to abstract "web framework" as a template choice.
- **No deployment/infrastructure automation.** Each generated repo's
  hosting, secrets, and deploy pipeline are project-specific and set up
  after generation, not templated.

## 5. Templating Mechanism: Copier

The template repo is a [Copier](https://copier.readthedocs.io/) template
(`copier.yml` at the root), not a plain GitHub "template repository".
Rationale: GitHub's "Use this template" produces a one-time,
disconnected copy — no way to pull a later bugfix into an already
generated repo. Copier keeps a `.copier-answers.yml` in every generated
repo recording which template version (git ref) it was generated from,
and supports `copier update` to replay the diff between template
versions onto the generated repo, doing a per-file merge (conflict
markers only where the generated repo diverged from the template in a
way that clashes with the incoming change).

### 5.1 Generation

```bash
copier copy gh:nuno-morais/repo-template-nestjs-next my-new-project
```

Prompts (defined in `copier.yml`):

| Variable | Purpose | Default |
|---|---|---|
| `project_name` | Repo/package name, Postgres DB name, Docker container names | (required, kebab-case) |
| `project_description` | `package.json` description, README title | (required) |
| `service_log_name` | Pino `service` tag in structured logs | `{{ project_name }}-api` |
| `api_port` | Host port for the API (Docker + local) | `3001` |
| `web_port` | Host port for the Next.js dev server | `3002` |
| `postgres_port` | Host port for Postgres | `5434` |

Ports default to `casamento-simples`'s values but are prompted (not
hardcoded) specifically because this workspace regularly runs several of
these repos/worktrees concurrently — `contract-guard` already had to pick
a different Postgres port (`5436`) by hand to avoid colliding with
`casamento-simples` (`5434`). Templating the prompt turns that manual
step into an explicit question at generation time.

### 5.2 Update

```bash
cd my-new-project
copier update
```

Run whenever the template repo gets a tagged fix/improvement worth
pulling in. Not automatic, not CI-enforced — a deliberate, occasional
maintenance action.

### 5.3 Versioning

The template repo uses git tags (`v1`, `v2`, ...) for releases `copier
update` can target. `CHANGELOG.md` at the template root records what
changed per tag, so maintainers know why an update touched what it
touched.

## 6. Testing the Template

Two layers:

1. **Generated project's own e2e test.** The template ships exactly one
   Playwright e2e spec that exercises the minimal real path: Clerk
   sign-in on the web app → an authenticated request to one API
   endpoint (the example domain module from section 3) → asserting the
   response renders. This is the answer to "does the wiring actually
   work", not just "does it compile". Documented in the post-create
   checklist that this test **requires its own Clerk test application**
   per generated project — Clerk test credentials are not shared across
   projects (each project gets its own Clerk instance/test users, same
   as `casamento-simples` and `contract-guard` already do independently).

2. **Template self-check.** Because this is non-trivial generation logic
   (Jinja templating + conditional files), the template repo itself
   keeps a throwaway smoke script (`scripts/verify-template.sh`, not
   shipped to generated projects) that runs `copier copy` into a temp
   directory with default answers and asserts: `yarn install` succeeds,
   `yarn verify:lint`/`verify:type:api`/`verify:type:web` succeed, and
   `docker compose up` + the one e2e test pass. This is the template's
   own regression test — if a template edit breaks generation, this
   script catches it before someone hits it while creating a real repo.

## 7. Post-Create Checklist (shipped as `docs/POST_CREATE.md`)

Manual steps that cannot be templated because they require external
accounts/decisions:

1. Create a Clerk application (test + production instances) for the new
   project; set `CLERK_SECRET_KEY` / publishable key in `.env` and CI
   secrets.
2. Set `CLIENT_ORIGINS` for CORS.
3. Replace the example domain module (section 3) with the project's
   first real module, or delete it if not needed yet.
4. Fill in the project-specific sections of
   `docs/architecture/system-architecture.md` (domain model, tenancy
   rules if applicable).
5. Set up hosting/deploy workflow — not templated (see Non-Goals).

## 8. Data Flow / Error Handling

No new runtime data flow: the generated project's data flow is exactly
`casamento-simples`'s existing pattern (client → NestJS controller →
service → TypeORM repository → Postgres; HATEOAS `_links` optional per
project, kept as an available pattern in the example module but not
mandated). Error handling is the existing `AllExceptionsFilter` +
`ValidationPipe` exception factory, copied as-is. This spec introduces
no new production error paths — the only new "runtime" is the
generation/update process itself (Copier), whose failure mode is a
non-zero exit code with either template-syntax errors (creation) or
merge-conflict markers left in files for a human to resolve (update).

## 9. Evolution Path

When a piece of code has been copy-identical across two or more
generated repos for a while with no per-project customization, that is
the trigger to extract it into a shared package — not before. This spec
deliberately stops at "one good template + an update mechanism" so that
decision is made from evidence (real repos, real divergence or lack of
it) rather than upfront guessing.
