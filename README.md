# {{ project_name }}

{{ project_description }}

Generated from [repo-template-nestjs-next](https://github.com/nuno-morais/repo-template-nestjs-next).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| HTTP Adapter | Express 5 |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL 16 |
| Validation | class-validator + class-transformer |
| Authentication | Clerk (`@clerk/backend`, `@clerk/nextjs`) |
| Documentation | `@nestjs/swagger` — OpenAPI 3.0 + Swagger UI at `/docs` |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS |
| Containers | Docker + Docker Compose |

## Local Development

Choose one development mode. Do not run both simultaneously on the same ports.

### Mode 1: Local Node Process (Recommended)

Runs Postgres in Docker and application processes directly on host:

```bash
cp .env.example .env   # fill in Clerk keys
docker compose up -d postgres
yarn install
yarn migration:run
yarn start:dev          # API on http://localhost:{{ api_port }}
yarn --cwd apps/web dev # Web on http://localhost:{{ web_port }}
```

### Mode 2: Containerized API

Runs API and Postgres services inside Docker Compose:

```bash
cp .env.example .env   # fill in Clerk keys
docker compose up -d
docker compose exec api yarn migration:run
yarn --cwd apps/web dev # Web on http://localhost:{{ web_port }}
```

## Endpoints

- API: `http://localhost:{{ api_port }}/v1`
- Health check: `http://localhost:{{ api_port }}/v1/health`
- Swagger UI: `http://localhost:{{ api_port }}/docs`
- Web UI: `http://localhost:{{ web_port }}`
- Postgres: `localhost:{{ postgres_port }}`

## Verification

Run local verification pipeline:

```bash
scripts/verify.sh
```
Prerequisites:
- Docker running (provisions isolated test Postgres container binding host port `{{ postgres_port + 1 }}`).
- Clerk test keys (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) set in `.env`.

Pipeline checks:
- Linting (`yarn verify:lint`)
- API contract drift check (`yarn verify:api-contract`)
- TypeScript types (`yarn verify:type:api`, `yarn verify:type:web`)
- Unit tests (`yarn verify:test:api-unit`, `yarn verify:test:web-unit`)
- API integration tests with test Postgres (`yarn verify:test:api-integration`)
- Authenticated Playwright e2e test (`yarn verify:test:e2e`)
- Production builds (`yarn verify:build:api`, `yarn verify:build:web`)
- Dependency security audit (`yarn verify:audit:production`)

CI workflow executes equivalent checks on pull requests and pushes to `main` via `.github/workflows/ci.yml`.

## Template Updates

Template maintenance uses versioned git tags (`v1`, `v1.1.0`) on the template repository. Downstream projects pull template improvements using Copier:

```bash
copier update
```

Requirements for `copier update`:
- Destination project git repository clean (no uncommitted changes).
- Upstream template uses versioned PEP 440 git tags.

To preview or test against a specific git reference:

```bash
copier update --vcs-ref HEAD
```

## Documentation

- [System Architecture](docs/architecture/system-architecture.md)
- [Post-Create Checklist](docs/POST_CREATE.md)
- [E2E Test Setup](e2e/README.md)
