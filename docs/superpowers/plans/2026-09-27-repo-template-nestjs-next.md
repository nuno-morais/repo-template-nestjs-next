# Repo Template (NestJS + Next.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `repo-template-nestjs-next`, a Copier template that generates a working NestJS + Next.js + PostgreSQL + Clerk monorepo, so new projects start from a running skeleton instead of re-deriving conventions.

**Architecture:** A single Copier-templated git repo, generalized from `casamento-simples`, with all wedding-domain modules removed and replaced by one generic `widgets` CRUD module that demonstrates the module pattern end to end (entity → migration → service → controller → DTO → Swagger → unit test → API-integration test → web page → Playwright e2e).

**Tech Stack:** NestJS 11, Next.js 15 (App Router, React 19), TypeORM 0.3 + PostgreSQL 16, Clerk (`@clerk/backend`, `@clerk/nextjs`, `@clerk/testing`), Copier for templating, Yarn workspaces, Jest + Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-repo-template-design.md`

## Global Constraints

- Copier config: `_templates_suffix: ""` (every text file is a Jinja template — no per-file `.jinja` renaming).
- Prompted variables (no hardcoded defaults baked into files): `project_name` (kebab-case, validated), `project_description`, `service_log_name` (default `{{ project_name }}-api`), `api_port` (default `3001`), `web_port` (default `3002`), `postgres_port` (default `5434`).
- Postgres/Docker-unsafe characters: anywhere a database or container name is derived from `project_name`, apply the Jinja filter `| replace("-", "_")` (hyphens are invalid in unquoted Postgres identifiers).
- No shared runtime package — every file is copied to the generated repo (except `docs/superpowers/**`, `TEMPLATE.md`, `TEMPLATE_CHANGELOG.md`, `scripts/verify-template.sh`, `copier.yml`, which stay template-only via `_exclude`).
- No wedding-domain modules, no `Organization`/`PartnerInvitation` entities, no auto-tenant-provisioning logic — the shipped `ClerkAuthGuard` verifies the JWT and reads `org_id`/`sub` directly from claims (falling back to `user_${sub}` when the caller has no active Clerk organization). This is a deliberate simplification versus `casamento-simples`'s guard, which auto-provisions an `Organization` row per tenant — that data model is product-specific and out of scope (see spec §4 Non-Goals).
- No deployment/backup/restore/credential-recovery/load-testing scripts or workflows.
- Every generated project needs its own Clerk **test** application (own publishable/secret key pair, own seeded test user) — never shared across projects. This applies to both the Playwright e2e (Task 10) and local dev.
- `.copier-answers.yml` is Copier's own default output in the generated repo — no task creates it by hand.
- Every runnable verification a task calls for must actually be run and its real output reported before that task is considered done.

## Review Focus

- **Invalid `project_name` input** (uppercase, spaces, leading digit) must fail the Copier prompt with a clear message before any file is written, not produce a broken `package.json`/Docker Compose file. Covered in Task 1.
- **Two generated projects running locally at once** must not collide on ports or the Postgres container name by default — this is the entire reason ports are prompted instead of hardcoded (see spec §5.1: `contract-guard` already had to pick `5436` by hand to avoid colliding with `casamento-simples`'s `5434`). Covered in Task 1 (self-check greps for leaked literal `3001`/`3002`/`5434` outside the intended default value) and Task 2.
- **Clerk caller with no active organization** (`org_id` absent from claims — an individual user, not an org member) must not crash the guard; it must fall back to a stable per-user scope. Covered in Task 4.
- **Placeholder `CLERK_SECRET_KEY` in production** must fail startup validation loudly, not silently accept a test key in prod. Covered in Task 3.
- **A widget request for another organization's ID** must 404, not leak or 500 — this is the only authorization boundary the example module has, and it must be proven, not assumed. Covered in Task 5.

---

### Task 1: Copier scaffold & root project files

**Files:**
- Create: `copier.yml`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.prettierrc`
- Create: `eslint.config.mjs`
- Create: `nest-cli.json`
- Create: `.gitignore`
- Create: `AGENTS.md`
- Create: `TEMPLATE.md`
- Create: `TEMPLATE_CHANGELOG.md`

**Interfaces:**
- Produces: a Copier-generatable repo whose `package.json` `name`/`description` fields come from the `project_name`/`project_description` answers. Later tasks add files under `apps/api/src/**` and `apps/web/src/**` that this `package.json`'s `workspaces: ["apps/*"]` picks up automatically — no further wiring needed here.

- [ ] **Step 1: Write `copier.yml`**

```yaml
_templates_suffix: ""
_exclude:
  - "copier.yml"
  - ".git"
  - "TEMPLATE.md"
  - "TEMPLATE_CHANGELOG.md"
  - "docs/superpowers"
  - "scripts/verify-template.sh"

project_name:
  type: str
  help: "Project name (kebab-case: package name, Docker container names, database name)"
  validator: >-
    {% if not (project_name | regex_search('^[a-z][a-z0-9-]*[a-z0-9]$')) %}
    project_name must be lowercase kebab-case, starting with a letter (e.g. my-new-project)
    {% endif %}

project_description:
  type: str
  help: "One-sentence project description (used in package.json and README)"

service_log_name:
  type: str
  help: "Pino 'service' tag in structured logs"
  default: "{{ project_name }}-api"

api_port:
  type: int
  help: "Host port for the API (Docker + local dev). Pick a free port if you already have another generated project running."
  default: 3001

web_port:
  type: int
  help: "Host port for the Next.js dev server. Pick a free port if you already have another generated project running."
  default: 3002

postgres_port:
  type: int
  help: "Host port for Postgres. Pick a free port if you already have another generated project running."
  default: 5434
```

- [ ] **Step 2: Write root `package.json`**

```json
{
  "name": "{{ project_name }}",
  "version": "0.1.0",
  "private": true,
  "description": "{{ project_description }}",
  "workspaces": [
    "apps/*"
  ],
  "resolutions": {
    "**/multer": "2.3.0",
    "**/postcss": "8.5.28",
    "**/vitest": "3.2.6"
  },
  "scripts": {
    "prebuild": "yarn generate:api-contract",
    "build": "nest build api",
    "generate:api-contract": "ts-node -r tsconfig-paths/register scripts/generate-api-contract.ts",
    "verify:api-contract": "yarn generate:api-contract && git diff --exit-code apps/web/src/types/api-contract.ts",
    "start": "nest start api",
    "start:dev": "nest start api --watch",
    "start:debug": "nest start api --debug --watch",
    "start:prod": "node dist/apps/api/main",
    "lint": "eslint \"apps/**/*.ts\" --fix",
    "format": "prettier --write \"apps/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "playwright test",
    "test:api-e2e": "jest --config ./apps/api/test/jest-e2e.json",
    "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d ormconfig.ts",
    "migration:run": "yarn typeorm migration:run",
    "migration:revert": "yarn typeorm migration:revert",
    "migration:generate": "yarn typeorm migration:generate",
    "verify:lint": "eslint \"apps/**/*.{ts,tsx}\"",
    "verify:type:api": "tsc -p apps/api/tsconfig.app.json --noEmit --incremental false",
    "verify:type:web": "tsc -p apps/web/tsconfig.json --noEmit --incremental false",
    "verify:test:api-unit": "jest --runInBand",
    "verify:test:web-unit": "yarn --cwd apps/web test",
    "verify:test:api-integration": "scripts/verify-api-integration.sh",
    "verify:test:e2e": "playwright test",
    "verify:build:api": "nest build api",
    "verify:build:web": "yarn --cwd apps/web build",
    "verify:audit:production": "yarn audit --groups dependencies",
    "verify": "scripts/verify.sh"
  },
  "dependencies": {
    "@clerk/backend": "^1.24.1",
    "@nestjs/common": "^11.0.11",
    "@nestjs/config": "^4.0.1",
    "@nestjs/core": "^11.0.11",
    "@nestjs/platform-express": "^11.0.11",
    "@nestjs/swagger": "^11.0.6",
    "@nestjs/typeorm": "^11.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "express": "^5.0.1",
    "helmet": "^8.3.0",
    "nestjs-pino": "^4.3.1",
    "pg": "^8.13.3",
    "pino": "^9.6.0",
    "pino-http": "^10.4.0",
    "pino-pretty": "^13.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "typeorm": "^0.3.21"
  },
  "devDependencies": {
    "@clerk/testing": "^1.4.13",
    "@nestjs/cli": "^11.0.5",
    "@nestjs/schematics": "^11.0.2",
    "@nestjs/testing": "^11.0.11",
    "@playwright/test": "^1.49.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.13.9",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^8.26.0",
    "@typescript-eslint/parser": "^8.26.0",
    "eslint": "^9.21.0",
    "eslint-config-prettier": "^10.0.2",
    "eslint-plugin-prettier": "^5.2.3",
    "jest": "^29.7.0",
    "openapi-typescript": "^7.13.0",
    "prettier": "^3.5.2",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.6",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.8.2"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "apps/api/src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 3: Write root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "isolatedModules": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 4: Write `.prettierrc`**

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

- [ ] **Step 5: Write `eslint.config.mjs`**

```js
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url));

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.next/**',
      'apps/web/.next/**',
      'apps/web/next-env.d.ts',
    ],
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'apps/web/tsconfig.json',
        tsconfigRootDir: repositoryRoot,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@typescript-eslint': tsPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['apps/api/src/**/*.{ts,tsx}', 'apps/web/src/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', '**/test/**'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', '**/test/**'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
```

- [ ] **Step 6: Write `nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/api/src",
  "monorepo": true,
  "root": "apps/api",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": true,
    "tsConfigPath": "apps/api/tsconfig.app.json"
  },
  "projects": {
    "api": {
      "type": "application",
      "root": "apps/api",
      "entryFile": "main",
      "sourceRoot": "apps/api/src",
      "compilerOptions": {
        "tsConfigPath": "apps/api/tsconfig.app.json"
      }
    }
  }
}
```

- [ ] **Step 7: Write `.gitignore`**

```
node_modules/
dist/
coverage/
.env
.env.local
.env.*.local
apps/web/.next/
apps/web/next-env.d.ts
test-results/
playwright-report/
.auth/
*.log
.DS_Store
```

- [ ] **Step 8: Write `AGENTS.md`**

```markdown
# {{ project_name }}

## Language

Conversation with the user is in Portuguese. Project artifacts are always in English — documentation, code (identifiers, comments, strings), commit messages, PR titles and bodies, issues.

Write an artifact in another language only when asked explicitly, or when user-facing copy of a product is localized.

## Working Rules

- Read relevant project instructions before making changes.
- Check `git status`; preserve unrelated work and prefer small edits.
- Preserve project conventions, architecture, language, and style.
- Never modify secrets or destructive infrastructure without confirmation.
- Run tests, lint, and build checks before committing.
- After creating a commit, push it to the remote immediately in the same turn — never leave a local commit unpushed for later.
```

- [ ] **Step 9: Write `TEMPLATE.md`** (excluded from generated projects)

```markdown
# repo-template-nestjs-next

Copier template for new NestJS + Next.js + PostgreSQL + Clerk projects.
Design rationale: `docs/superpowers/specs/2026-09-27-repo-template-design.md`.

## Generate a new project

```bash
copier copy gh:nuno-morais/repo-template-nestjs-next my-new-project
```

## Pull a later template fix into an already-generated project

```bash
cd my-new-project
copier update
```

Resolve any `<<<<<<<`/`=======`/`>>>>>>>` conflict markers Copier leaves
where the generated project diverged from the template.

## Release a new template version

1. Update `TEMPLATE_CHANGELOG.md`.
2. `git tag vN && git push --tags`.

## Maintainer self-check

```bash
scripts/verify-template.sh
```

Generates a throwaway project with default answers and runs its lint,
type-check, and unit-test suites. Run this before tagging a release.
```

- [ ] **Step 10: Write `TEMPLATE_CHANGELOG.md`** (excluded from generated projects)

```markdown
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
```

- [ ] **Step 11: Run the generator locally and confirm substitution**

```bash
copier copy . /tmp/repo-template-selfcheck-1 \
  --data project_name=selfcheck-one \
  --data project_description="Self-check project" \
  --defaults
grep '"name": "selfcheck-one"' /tmp/repo-template-selfcheck-1/package.json
grep '"description": "Self-check project"' /tmp/repo-template-selfcheck-1/package.json
test ! -f /tmp/repo-template-selfcheck-1/TEMPLATE.md
test ! -f /tmp/repo-template-selfcheck-1/copier.yml
rm -rf /tmp/repo-template-selfcheck-1
```

Expected: both `grep` commands print the matching line; both `test`
commands exit `0` (files correctly excluded); no Jinja/Copier error output.

- [ ] **Step 12: Confirm the validator rejects an invalid `project_name`**

```bash
copier copy . /tmp/repo-template-selfcheck-2 \
  --data project_name="Not Valid" \
  --data project_description="x" \
  --defaults
```

Expected: non-zero exit, error message containing "must be lowercase
kebab-case". If the command instead writes files, fix the `validator`
regex in `copier.yml` before proceeding.

- [ ] **Step 13: Commit**

```bash
git add copier.yml package.json tsconfig.json .prettierrc eslint.config.mjs nest-cli.json .gitignore AGENTS.md TEMPLATE.md TEMPLATE_CHANGELOG.md
git commit -m "feat: scaffold Copier template with root project config"
```

---

### Task 2: Docker & persistence base

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.test.yml`
- Create: `Dockerfile`
- Create: `ormconfig.ts`
- Create: `.env.example`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.app.json`

**Interfaces:**
- Consumes: `project_name`, `api_port`, `web_port`, `postgres_port` prompts from Task 1's `copier.yml`.
- Produces: a running local Postgres reachable at `DB_HOST=localhost` / `DB_PORT={{ postgres_port }}` (or `DATABASE_URL`), which Task 3's `TypeOrmModule.forRootAsync` and Task 5's migration connect to.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '{{ api_port }}:3000'
    environment:
      - PORT=3000
      - NODE_ENV=development
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USERNAME=postgres
      - DB_PASSWORD=postgres
      - DB_NAME={{ project_name | replace("-", "_") }}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - CLIENT_ORIGINS=http://localhost:{{ web_port }}
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    ports:
      - '{{ postgres_port }}:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: {{ project_name | replace("-", "_") }}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

- [ ] **Step 2: Write `docker-compose.test.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: {{ project_name }}-postgres-test
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: {{ project_name | replace("-", "_") }}_test
      PGPORT: '{{ postgres_port }}'
      PGUSER: postgres
    command: ['postgres', '-p', '{{ postgres_port }}', '-c', 'shared_buffers=128MB']
    ports:
      - '{{ postgres_port }}:{{ postgres_port }}'
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h 127.0.0.1 -p {{ postgres_port }}']
      interval: 2s
      timeout: 5s
      retries: 10
```

- [ ] **Step 3: Write `Dockerfile`**

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock* ./

RUN yarn install --frozen-lockfile || yarn install

COPY . .

EXPOSE 3000

CMD ["yarn", "start:dev"]
```

- [ ] **Step 4: Write `ormconfig.ts`**

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const baseOptions: DataSourceOptions = process.env.DATABASE_URL
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: ['apps/api/src/entities/**/*.entity.ts'],
      migrations: ['apps/api/src/migrations/*.ts'],
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
    }
  : {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || '{{ project_name | replace("-", "_") }}',
      entities: ['apps/api/src/entities/**/*.entity.ts'],
      migrations: ['apps/api/src/migrations/*.ts'],
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
    };

export default new DataSource(baseOptions);
```

- [ ] **Step 5: Write `.env.example`**

```
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT={{ postgres_port }}
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME={{ project_name | replace("-", "_") }}
CLERK_SECRET_KEY=sk_test_replace_with_actual_clerk_secret_key
CLERK_PUBLISHABLE_KEY=pk_test_replace_with_actual_clerk_publishable_key
CLIENT_ORIGINS=http://localhost:{{ web_port }}
```

- [ ] **Step 6: Write `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 7: Write `apps/api/tsconfig.app.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/api"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

- [ ] **Step 8: Verify port substitution end-to-end**

```bash
copier copy . /tmp/repo-template-selfcheck-3 \
  --data project_name=selfcheck-three \
  --data project_description="x" \
  --data api_port=4001 --data web_port=4002 --data postgres_port=5555 \
  --defaults
grep "4001:3000" /tmp/repo-template-selfcheck-3/docker-compose.yml
grep "5555:5432" /tmp/repo-template-selfcheck-3/docker-compose.yml
grep "DB_PORT=5555" /tmp/repo-template-selfcheck-3/.env.example
grep "selfcheck_three" /tmp/repo-template-selfcheck-3/docker-compose.yml
rm -rf /tmp/repo-template-selfcheck-3
```

Expected: all four `grep` commands print a matching line — proves ports
and the underscore-safe database name are substituted everywhere, not
left at the literal defaults from `copier.yml`.

- [ ] **Step 9: Commit**

```bash
git add docker-compose.yml docker-compose.test.yml Dockerfile ormconfig.ts .env.example apps/api/tsconfig.json apps/api/tsconfig.app.json
git commit -m "feat: add Docker, Postgres, and ormconfig scaffolding"
```

---

### Task 3: API cross-cutting bootstrap

**Files:**
- Create: `apps/api/src/security/origin-matcher.ts`
- Create: `apps/api/src/config/api-config.ts`
- Create: `apps/api/src/config/api-config.spec.ts`
- Create: `apps/api/src/config/api-logger.config.ts`
- Create: `apps/api/src/configure-app.ts`
- Create: `apps/api/src/swagger/swagger.ts`
- Create: `apps/api/src/swagger/common-responses.ts`
- Create: `apps/api/src/common/correlation/correlation-id.middleware.ts`
- Create: `apps/api/src/common/exceptions/all-exceptions.filter.ts`
- Create: `apps/api/src/common/exceptions/all-exceptions.filter.spec.ts`
- Create: `apps/api/src/common/dto/validation-error.dto.ts`
- Create: `apps/api/src/common/dto/pagination-query.dto.ts`
- Create: `apps/api/src/common/dto/paginated-response.dto.ts`
- Create: `apps/api/src/common/dto/hateoas-link.dto.ts`
- Create: `apps/api/src/common/pipes/pagination-validation.pipe.ts`
- Create: `apps/api/src/app.controller.ts`
- Create: `apps/api/src/app.controller.spec.ts`
- Create: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `DataSource` config keys `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME` or `DATABASE_URL` from `.env` (Task 2); `service_log_name`/`project_name`/`project_description` prompts from Task 1.
- Produces: `AppModule` (extended by Task 4 with the `APP_GUARD` provider and by Task 5 with `WidgetsModule`), `configureApp(app: INestApplication): void` (called from Task 4's `main.ts`), `validateApiEnvironment(source): ApiEnvironment` used by `ConfigModule.forRoot({ validate })`, `@Public()` decorator dependency note: `app.controller.ts` in Step 17 imports `Public` from `../common/decorators/public.decorator` — that file is created in Task 4 Step 1; the two tasks run in plan order so this resolves correctly once both are applied.

- [ ] **Step 1: Write `apps/api/src/security/origin-matcher.ts`**

```typescript
type OriginRule =
  | { kind: 'exact'; value: string }
  | {
      kind: 'wildcard-subdomain';
      protocol: string;
      port: string;
      suffix: string;
    };

function parseRule(entry: string): OriginRule {
  const url = new URL(entry);
  if (url.hostname.startsWith('*.')) {
    return {
      kind: 'wildcard-subdomain',
      protocol: url.protocol,
      port: url.port,
      suffix: url.hostname.slice(1),
    };
  }
  return { kind: 'exact', value: entry };
}

function matchesWildcard(rule: OriginRule, origin: URL): boolean {
  if (rule.kind === 'exact') return false;
  return (
    origin.protocol === rule.protocol &&
    origin.port === rule.port &&
    origin.hostname.endsWith(rule.suffix) &&
    origin.hostname.length > rule.suffix.length
  );
}

/**
 * Shared CLIENT_ORIGINS matcher used by the global CORS configuration in
 * configure-app.ts. Supports exact origins and a single wildcard-subdomain
 * entry per protocol/port (e.g. "https://*.example.com").
 */
export class OriginMatcher {
  private readonly exactOrigins: ReadonlySet<string>;
  private readonly wildcardRules: OriginRule[];

  constructor(clientOrigins: string) {
    const rules = clientOrigins.split(',').map(parseRule);
    this.exactOrigins = new Set(
      rules
        .filter(
          (rule): rule is Extract<OriginRule, { kind: 'exact' }> =>
            rule.kind === 'exact',
        )
        .map((rule) => rule.value),
    );
    this.wildcardRules = rules.filter(
      (rule) => rule.kind === 'wildcard-subdomain',
    );
  }

  matches(origin: string | undefined | null): boolean {
    if (!origin) return false;
    if (this.exactOrigins.has(origin)) return true;
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      return false;
    }
    return this.wildcardRules.some((rule) => matchesWildcard(rule, parsed));
  }
}
```

- [ ] **Step 2: Write `apps/api/src/config/api-config.ts`**

```typescript
export type ApiNodeEnvironment = 'development' | 'test' | 'production';
export type ApiEnvironment = Record<string, unknown> & {
  NODE_ENV: ApiNodeEnvironment;
  PORT: string;
  CLERK_SECRET_KEY: string;
  CLIENT_ORIGINS: string;
};

function fail(variable: string, rule: string): never {
  throw new Error(`API configuration error: ${variable} ${rule}.`);
}

function required(source: Record<string, unknown>, variable: string): string {
  const value = source[variable];
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fail(variable, 'is required');
}

function port(value: string, variable = 'PORT'): string {
  if (!/^\d+$/.test(value)) fail(variable, 'must be a positive TCP port');
  const parsed = Number(value);
  if (parsed < 1 || parsed > 65535) {
    fail(variable, 'must be a positive TCP port');
  }
  return String(parsed);
}

function origins(value: string, production: boolean): string {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) fail('CLIENT_ORIGINS', 'must not be empty');
  for (const entry of entries) {
    try {
      new URL(entry.startsWith('*.') ? entry.replace('*.', 'wild.') : entry);
    } catch {
      fail('CLIENT_ORIGINS', `must contain valid origin URLs (got "${entry}")`);
    }
  }
  if (production && entries.some((entry) => entry.includes('localhost'))) {
    fail('CLIENT_ORIGINS', 'must not include localhost in production');
  }
  return entries.join(',');
}

function database(source: Record<string, unknown>, production: boolean) {
  if (typeof source.DATABASE_URL === 'string' && source.DATABASE_URL.trim()) {
    let url: URL;
    try {
      url = new URL(source.DATABASE_URL);
    } catch {
      return fail('DATABASE_URL', 'must be a PostgreSQL URL');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      return fail('DATABASE_URL', 'must be a PostgreSQL URL');
    }
    return { DATABASE_URL: source.DATABASE_URL.trim() };
  }
  const value = (name: string, fallback: string) =>
    production ? required(source, name) : String(source[name] || fallback);
  return {
    DB_HOST: value('DB_HOST', 'localhost'),
    DB_PORT: port(value('DB_PORT', '5432'), 'DB_PORT'),
    DB_USERNAME: value('DB_USERNAME', 'postgres'),
    DB_PASSWORD: value('DB_PASSWORD', 'postgres'),
    DB_NAME: value('DB_NAME', 'app'),
  };
}

export function validateApiEnvironment(
  source: Record<string, unknown>,
): ApiEnvironment {
  const nodeEnvironment = required(source, 'NODE_ENV');
  if (!['development', 'test', 'production'].includes(nodeEnvironment)) {
    fail('NODE_ENV', 'must be development, test, or production');
  }
  const production = nodeEnvironment === 'production';
  const clerkSecret = required(source, 'CLERK_SECRET_KEY');
  if (production && clerkSecret.startsWith(['sk', 'test', ''].join('_'))) {
    fail('CLERK_SECRET_KEY', 'must not use a test key in production');
  }
  return {
    ...source,
    NODE_ENV: nodeEnvironment as ApiNodeEnvironment,
    PORT: port(String(source.PORT || '3000')),
    CLERK_SECRET_KEY: clerkSecret,
    CLIENT_ORIGINS: origins(required(source, 'CLIENT_ORIGINS'), production),
    ...database(source, production),
  };
}
```

- [ ] **Step 3: Write `apps/api/src/config/api-config.spec.ts`** (TDD: covers the Review Focus placeholder-secret-in-production case)

```typescript
import { validateApiEnvironment } from './api-config';

describe('validateApiEnvironment', () => {
  const base = {
    NODE_ENV: 'development',
    PORT: '3000',
    CLERK_SECRET_KEY: 'sk_test_placeholder',
    CLIENT_ORIGINS: 'http://localhost:3002',
    DB_HOST: 'localhost',
    DB_PORT: '5434',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'postgres',
    DB_NAME: 'app',
  };

  it('accepts a valid development configuration', () => {
    expect(() => validateApiEnvironment(base)).not.toThrow();
  });

  it('rejects a test Clerk secret key in production', () => {
    expect(() =>
      validateApiEnvironment({
        ...base,
        NODE_ENV: 'production',
        CLERK_SECRET_KEY: 'sk_test_placeholder',
        CLIENT_ORIGINS: 'https://app.example.com',
      }),
    ).toThrow(/must not use a test key in production/);
  });

  it('accepts a DATABASE_URL in place of discrete DB_* variables', () => {
    const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME, ...rest } =
      base;
    const result = validateApiEnvironment({
      ...rest,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5434/app',
    });
    expect(result.DATABASE_URL).toBe(
      'postgresql://postgres:postgres@localhost:5434/app',
    );
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() =>
      validateApiEnvironment({ ...base, DATABASE_URL: 'not-a-url' }),
    ).toThrow(/must be a PostgreSQL URL/);
  });
});
```

- [ ] **Step 4: Run the config spec and confirm it passes**

```bash
yarn jest config/api-config.spec.ts --runInBand
```

Expected: 4 passing tests.

- [ ] **Step 5: Write `apps/api/src/config/api-logger.config.ts`**

```typescript
export function apiPinoHttpOptions(production: boolean) {
  return {
    level: production ? 'info' : 'debug',
    transport: production
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
    autoLogging: true,
    base: { service: '{{ service_log_name }}' },
    redact: {
      censor: '[Redacted]',
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
      ],
    },
  };
}
```

- [ ] **Step 6: Write `apps/api/src/configure-app.ts`**

```typescript
import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { OriginMatcher } from './security/origin-matcher';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  const defaultHelmet = helmet({
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'sameorigin' },
  });

  const docsHelmet = helmet({
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'sameorigin' },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/docs') || req.path.startsWith('/v1/docs')) {
      return docsHelmet(req, res, next);
    }
    return defaultHelmet(req, res, next);
  });

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (validationErrors: ValidationError[] = []) =>
        new BadRequestException({
          statusCode: 400,
          message: 'Validation failed.',
          error: 'Bad Request',
          errors: validationErrors.map((error) => ({
            field: error.property,
            message: Object.values(error.constraints || {}).join(', '),
          })),
        }),
    }),
  );
  const originMatcher = new OriginMatcher(
    config.getOrThrow<string>('CLIENT_ORIGINS'),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => callback(null, originMatcher.matches(origin)),
    credentials: true,
  });
}
```

- [ ] **Step 7: Write `apps/api/src/swagger/common-responses.ts`**

```typescript
import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  ValidationErrorDto,
  GenericErrorDto,
} from '../common/dto/validation-error.dto';
import { PaginationMetaDto } from '../common/dto/paginated-response.dto';

export function UnauthorizedResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({
      status: 401,
      description: 'Missing or invalid Bearer token',
      type: GenericErrorDto,
    }),
  );
}

export function ForbiddenResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({
      status: 403,
      description: 'Caller is not authorized for this resource',
      type: GenericErrorDto,
    }),
  );
}

export function NotFoundResponse(
  message = 'Resource not found',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({
      status: 404,
      description: message,
      type: GenericErrorDto,
    }),
  );
}

export function ConflictResponse(
  message = 'Resource conflict or duplicate',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({
      status: 409,
      description: message,
      type: GenericErrorDto,
    }),
  );
}

export function BadRequestResponse(
  message = 'Bad request',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: message,
      type: GenericErrorDto,
    }),
  );
}

export function ValidationResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: 'Validation failed',
      type: ValidationErrorDto,
    }),
  );
}

export function PaginatedResponse(
  model: Type<unknown>,
  description = 'Paginated list of items',
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(model, PaginationMetaDto),
    ApiResponse({
      status: 200,
      description,
      schema: {
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
}
```

- [ ] **Step 8: Write `apps/api/src/swagger/swagger.ts`**

```typescript
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('{{ project_name }} API')
    .setDescription('{{ project_description }}')
    .setVersion('1.0')
    .addServer('/v1', 'Version 1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter Clerk Bearer JWT token',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
```

- [ ] **Step 9: Write `apps/api/src/common/correlation/correlation-id.middleware.ts`**

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export type CorrelatedRequest = Request & {
  correlationId: string;
  requestId: string;
};

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const supplied =
      request.headers['x-request-id'] || request.headers['x-correlation-id'];
    const correlationId =
      typeof supplied === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(supplied)
        ? supplied
        : randomUUID();

    const correlated = request as CorrelatedRequest;
    correlated.correlationId = correlationId;
    correlated.requestId = correlationId;

    response.setHeader('X-Request-Id', correlationId);
    response.setHeader('X-Correlation-Id', correlationId);
    next();
  }
}
```

- [ ] **Step 10: Write `apps/api/src/common/dto/validation-error.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class FieldValidationErrorDto {
  @ApiProperty({ example: 'name' })
  field: string;

  @ApiProperty({ example: 'name should not be empty' })
  message: string;
}

export class ValidationErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ type: [FieldValidationErrorDto] })
  errors: FieldValidationErrorDto[];
}

export class GenericErrorDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Resource not found' })
  message: string;

  @ApiProperty({ example: 'Not Found' })
  error: string;
}
```

- [ ] **Step 11: Write `apps/api/src/common/dto/pagination-query.dto.ts`**

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 1;
    const num = Number(value);
    return !Number.isInteger(num) || num <= 0 || isNaN(num) ? 1 : num;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (max 100)',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 20;
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0 || isNaN(num)) return 20;
    if (num > 100) return 100;
    return num;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
```

- [ ] **Step 12: Write `apps/api/src/common/dto/paginated-response.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 42, description: 'Total number of records' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Page limit' })
  limit: number;

  @ApiProperty({ example: 3, description: 'Total number of pages' })
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'List of records' })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto, description: 'Pagination metadata' })
  meta: PaginationMetaDto;
}
```

- [ ] **Step 13: Write `apps/api/src/common/dto/hateoas-link.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class HateoasLinkDto {
  @ApiProperty({ example: '/v1/widgets/123e4567-e89b-12d3-a456-426614174000' })
  href: string;

  @ApiProperty({ example: 'PUT', required: false })
  method?: string;
}
```

- [ ] **Step 14: Write `apps/api/src/common/pipes/pagination-validation.pipe.ts`**

```typescript
import { PipeTransform, Injectable } from '@nestjs/common';

@Injectable()
export class PaginationValidationPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (!value || typeof value !== 'object') {
      return { page: 1, limit: 20 };
    }

    const transformed: Record<string, unknown> = {
      ...(value as Record<string, unknown>),
    };

    const rawPage = transformed.page;
    if (rawPage !== undefined && rawPage !== null && rawPage !== '') {
      const pageNum = Number(rawPage);
      transformed.page =
        !Number.isInteger(pageNum) || pageNum <= 0 || isNaN(pageNum)
          ? 1
          : pageNum;
    } else {
      transformed.page = 1;
    }

    const rawLimit = transformed.limit;
    if (rawLimit !== undefined && rawLimit !== null && rawLimit !== '') {
      const limitNum = Number(rawLimit);
      if (!Number.isInteger(limitNum) || limitNum <= 0 || isNaN(limitNum)) {
        transformed.limit = 20;
      } else if (limitNum > 100) {
        transformed.limit = 100;
      } else {
        transformed.limit = limitNum;
      }
    } else {
      transformed.limit = 20;
    }

    return transformed;
  }
}
```

- [ ] **Step 15: Write `apps/api/src/common/exceptions/all-exceptions.filter.ts`**

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { CorrelatedRequest } from '../correlation/correlation-id.middleware';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>() as CorrelatedRequest;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let errors: Array<{ field: string; message: string }> | undefined;
    let extraFields: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message =
          typeof body.message === 'string' ? body.message : exception.message;
        error = typeof body.error === 'string' ? body.error : exception.name;
        if (Array.isArray(body.errors)) {
          errors = body.errors.filter(
            (item): item is { field: string; message: string } =>
              typeof item === 'object' &&
              item !== null &&
              typeof (item as Record<string, unknown>).field === 'string' &&
              typeof (item as Record<string, unknown>).message === 'string',
          );
        }
        for (const [key, val] of Object.entries(body)) {
          if (!['message', 'error', 'errors', 'statusCode'].includes(key)) {
            extraFields[key] = val;
          }
        }
      }
    } else if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as { code?: string };
      if (driverError && driverError.code === '23505') {
        statusCode = HttpStatus.CONFLICT;
        message = 'A resource with these unique properties already exists.';
        error = 'Conflict';
      } else if (driverError && driverError.code === '23503') {
        statusCode = HttpStatus.CONFLICT;
        message =
          'Cannot delete: this resource is still referenced by other records.';
        error = 'Conflict';
      } else if (driverError && driverError.code === '55P03') {
        statusCode = HttpStatus.CONFLICT;
        message =
          'The operation timed out waiting for concurrent updates to complete. Please retry.';
        error = 'Conflict';
        extraFields = { code: 'CONCURRENCY_CONFLICT' };
      } else {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        message =
          this.config.getOrThrow('NODE_ENV') === 'production'
            ? 'A database error occurred.'
            : exception.message;
        error = 'Database Error';
      }
    } else if (exception instanceof Error) {
      message =
        this.config.getOrThrow('NODE_ENV') === 'production'
          ? 'An unexpected error occurred.'
          : exception.message;
      error =
        this.config.getOrThrow('NODE_ENV') === 'production'
          ? 'Internal Server Error'
          : exception.name || 'Internal Server Error';
    }

    const correlationId =
      request.correlationId || request.requestId || randomUUID();
    this.logger.error({
      statusCode,
      message,
      error,
      correlationId,
      path: request.url,
    });

    response.setHeader('X-Request-Id', correlationId);
    response.setHeader('X-Correlation-Id', correlationId);

    const payload: Record<string, unknown> = {
      statusCode,
      message,
      error,
      ...(errors ? { errors } : {}),
      ...extraFields,
    };

    if (request.headers['x-request-id'] || extraFields.code) {
      payload.requestId = correlationId;
    }

    response.status(statusCode).json(payload);
  }
}
```

- [ ] **Step 16: Write `apps/api/src/common/exceptions/all-exceptions.filter.spec.ts`**

```typescript
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './all-exceptions.filter';

function buildHost(request: Partial<Request> = {}) {
  const response = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, url: '/v1/widgets', ...request }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  const config = { getOrThrow: jest.fn().mockReturnValue('test') };
  const filter = new AllExceptionsFilter(config as unknown as ConfigService);

  it('maps an HttpException to its own status and message', () => {
    const { host, response } = buildHost();
    filter.catch(
      new HttpException('Widget not found', HttpStatus.NOT_FOUND),
      host,
    );
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Widget not found' }),
    );
  });

  it('maps an unknown error to a 500 with a generic message outside production', () => {
    const { host, response } = buildHost();
    filter.catch(new Error('boom'), host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'boom' }),
    );
  });
});
```

- [ ] **Step 17: Write `apps/api/src/app.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class AppController {
  @Get()
  @Public()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 18: Write `apps/api/src/app.controller.spec.ts`**

```typescript
import { AppController } from './app.controller';

describe('AppController', () => {
  it('reports ok on the health endpoint', () => {
    const controller = new AppController();
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 19: Write `apps/api/src/app.module.ts`** (minimal; Task 4 adds the `APP_GUARD` provider and `main.ts`; Task 5 adds `WidgetsModule`)

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';
import { validateApiEnvironment } from './config/api-config';
import { CorrelationIdMiddleware } from './common/correlation/correlation-id.middleware';
import { apiPinoHttpOptions } from './config/api-logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      validate: validateApiEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const production =
          configService.getOrThrow('NODE_ENV') === 'production';
        return { pinoHttp: apiPinoHttpOptions(production) };
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            autoLoadEntities: true,
            synchronize: false,
          };
        }
        return {
          type: 'postgres' as const,
          host: configService.getOrThrow<string>('DB_HOST'),
          port: parseInt(configService.getOrThrow<string>('DB_PORT'), 10),
          username: configService.getOrThrow<string>('DB_USERNAME'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_NAME'),
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 20: Commit**

```bash
git add apps/api/src/configure-app.ts apps/api/src/security apps/api/src/config apps/api/src/swagger apps/api/src/common apps/api/src/app.controller.ts apps/api/src/app.controller.spec.ts apps/api/src/app.module.ts
git commit -m "feat: add API cross-cutting bootstrap (config, logging, swagger, exceptions)"
```

---

### Task 4: Auth (Clerk guard, decorators, synthetic token minting)

**Files:**
- Create: `apps/api/src/common/decorators/public.decorator.ts`
- Create: `apps/api/src/common/decorators/current-user.decorator.ts`
- Create: `apps/api/src/common/decorators/current-org.decorator.ts`
- Create: `apps/api/src/auth/clerk.guard.ts`
- Create: `apps/api/src/auth/clerk.guard.spec.ts`
- Create: `apps/api/test/fixtures/token-minter.ts`
- Create: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts` (add `ClerkAuthGuard` as `APP_GUARD`)

**Interfaces:**
- Consumes: `CLERK_SECRET_KEY` / `CLERK_JWT_KEY` env vars; `configureApp`/`setupSwagger` from Task 3.
- Produces: `ClerkAuthGuard` (registered globally via `APP_GUARD`), `@Public()`, `@CurrentUser()`, `@CurrentOrg()` decorators, and `SyntheticTokenMinter`/`defaultTokenMinter` (consumed by Task 5's API-integration test).

- [ ] **Step 1: Write `apps/api/src/common/decorators/public.decorator.ts`**

```typescript
import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: Write `apps/api/src/common/decorators/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class AuthenticatedUser {
  sub: string;
  email?: string;
  orgId?: string;
  orgRole?: string;
  [key: string]: unknown;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

- [ ] **Step 3: Write `apps/api/src/common/decorators/current-org.decorator.ts`**

```typescript
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const orgId = request.orgId || request.user?.orgId;
    if (!orgId) {
      throw new UnauthorizedException(
        'No organization context found in session',
      );
    }
    return orgId;
  },
);
```

- [ ] **Step 4: Write `apps/api/test/fixtures/token-minter.ts`**

```typescript
import { generateKeyPairSync, createSign } from 'node:crypto';

export interface SyntheticTokenClaims {
  sub?: string;
  email?: string;
  org_id?: string;
  orgId?: string;
  org_role?: string;
  orgRole?: string;
  [key: string]: unknown;
}

export interface MintTokenOptions {
  expiresInSeconds?: number;
  header?: Record<string, unknown>;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Signs RS256 JWTs with a deterministic (or generated) keypair so API tests
 * can exercise ClerkAuthGuard's "networkless" verification path
 * (CLERK_JWT_KEY) without calling the real Clerk API. This is a test-only
 * mechanism: the keypair carries no relationship to any real Clerk
 * instance's keys.
 */
export class SyntheticTokenMinter {
  public readonly publicKey: string;
  public readonly privateKey: string;

  constructor(keyPair?: { publicKey: string; privateKey: string }) {
    if (keyPair) {
      this.publicKey = keyPair.publicKey;
      this.privateKey = keyPair.privateKey;
      return;
    }
    const generated = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.publicKey = generated.publicKey;
    this.privateKey = generated.privateKey;
  }

  mintToken(
    claims: SyntheticTokenClaims = {},
    options: MintTokenOptions = {},
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', ...options.header };
    const payload = {
      sub: claims.sub || 'user_synthetic',
      iat: now,
      exp: now + (options.expiresInSeconds ?? 3600),
      ...claims,
    };
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const signer = createSign('RSA-SHA256');
    signer.update(`${encodedHeader}.${encodedPayload}`);
    const signature = base64url(signer.sign(this.privateKey));
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  mintUserToken(sub: string, email?: string): string {
    return this.mintToken({ sub, email });
  }

  mintOrgToken(sub: string, orgId: string, orgRole = 'org:admin'): string {
    return this.mintToken({ sub, org_id: orgId, org_role: orgRole });
  }
}

export const defaultTokenMinter = new SyntheticTokenMinter();
```

- [ ] **Step 5: Write `apps/api/src/auth/clerk.guard.ts`**

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

const CLERK_PLACEHOLDER_SECRET_PREFIX = ['sk', 'test', 'placeholder'].join('_');

/**
 * Verifies the Clerk Bearer JWT and attaches `req.user` / `req.orgId` from
 * its claims. Deliberately does not auto-provision or look up any
 * Organization entity — that tenancy data model is project-specific and
 * left for the generated project to add if it needs one. `org_id` missing
 * from claims (an individual Clerk user, not an org member) falls back to
 * a stable per-user scope (`user_<sub>`) rather than failing.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (isPublic && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return true;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    const jwtKey = process.env.CLERK_JWT_KEY;
    const isProd = process.env.NODE_ENV === 'production';
    const isPlaceholderSecret =
      !secretKey || secretKey.startsWith(CLERK_PLACEHOLDER_SECRET_PREFIX);

    if (isProd && isPlaceholderSecret && !jwtKey) {
      throw new UnauthorizedException(
        'CLERK_SECRET_KEY is not configured for production',
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (isPublic) return true;
      throw new UnauthorizedException(
        'Missing or malformed Authorization header',
      );
    }

    const token = authHeader.split(' ')[1];

    try {
      const verifiedPayload = await verifyToken(token, {
        ...(secretKey ? { secretKey } : {}),
        ...(jwtKey ? { jwtKey } : {}),
      });

      const claims = verifiedPayload as Record<string, unknown>;
      const rawOrgId = (claims.org_id || claims.orgId) as string | undefined;
      const orgId = rawOrgId || `user_${verifiedPayload.sub}`;

      request.user = {
        sub: verifiedPayload.sub,
        email: claims.email,
        orgId,
        orgRole: claims.org_role || claims.orgRole,
      };
      request.orgId = orgId;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

- [ ] **Step 6: Write `apps/api/src/auth/clerk.guard.spec.ts`** (covers the Review Focus "no active organization" and placeholder-secret cases)

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkAuthGuard } from './clerk.guard';
import { defaultTokenMinter } from '../../test/fixtures/token-minter';

function buildContext(authorization?: string) {
  const request: Record<string, unknown> = {
    headers: authorization ? { authorization } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    request,
  } as unknown as ExecutionContext & { request: Record<string, unknown> };
}

describe('ClerkAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const guard = new ClerkAuthGuard(reflector as unknown as Reflector);
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    process.env.CLERK_JWT_KEY = defaultTokenMinter.publicKey;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects requests with no Authorization header', async () => {
    const context = buildContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches orgId from an org-scoped token', async () => {
    const token = defaultTokenMinter.mintOrgToken('user_1', 'org_123');
    const context = buildContext(`Bearer ${token}`);

    await guard.canActivate(context);

    expect(context.request.orgId).toBe('org_123');
    expect((context.request.user as { sub: string }).sub).toBe('user_1');
  });

  it('falls back to a per-user scope when the token has no org_id', async () => {
    const token = defaultTokenMinter.mintUserToken('user_2');
    const context = buildContext(`Bearer ${token}`);

    await guard.canActivate(context);

    expect(context.request.orgId).toBe('user_user_2');
  });

  it('rejects an invalid token', async () => {
    const context = buildContext('Bearer not-a-real-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when CLERK_SECRET_KEY is a placeholder in production with no CLERK_JWT_KEY', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CLERK_JWT_KEY;
    const context = buildContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 7: Run the guard spec and confirm it passes**

```bash
yarn jest auth/clerk.guard.spec.ts --runInBand
```

Expected: 5 passing tests.

- [ ] **Step 8: Write `apps/api/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { setupSwagger } from './swagger/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  configureApp(app);

  setupSwagger(app);

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`[{{ service_log_name }}] server started on port ${port} with prefix /v1`);
}

void bootstrap();
```

- [ ] **Step 9: Modify `apps/api/src/app.module.ts`** to register the guard globally

Add the import `APP_GUARD` alongside the existing `APP_FILTER` import:

```typescript
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
```

add:

```typescript
import { ClerkAuthGuard } from './auth/clerk.guard';
```

and extend the `providers` array (currently only the `APP_FILTER` entry
from Task 3 Step 19) to:

```typescript
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
```

- [ ] **Step 10: Confirm the whole API type-checks and its unit tests pass**

```bash
yarn tsc -p apps/api/tsconfig.app.json --noEmit
yarn jest --runInBand
```

Expected: no type errors; all specs from Tasks 3 and 4 pass (`api-config`,
`all-exceptions.filter`, `app.controller`, `clerk.guard`).

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/common/decorators apps/api/src/auth apps/api/test/fixtures apps/api/src/main.ts apps/api/src/app.module.ts
git commit -m "feat: add simplified Clerk auth guard and synthetic token minting for tests"
```

---

### Task 5: Widgets domain module (example CRUD + API-integration test)

**Files:**
- Create: `apps/api/src/entities/widget.entity.ts`
- Create: `apps/api/src/migrations/20260927120000-InitialSchema.ts`
- Create: `apps/api/src/widgets/create-widget.dto.ts`
- Create: `apps/api/src/widgets/widget-response.dto.ts`
- Create: `apps/api/src/widgets/widgets.service.ts`
- Create: `apps/api/src/widgets/widgets.service.spec.ts`
- Create: `apps/api/src/widgets/widgets.swagger.ts`
- Create: `apps/api/src/widgets/widgets.controller.ts`
- Create: `apps/api/src/widgets/widgets.module.ts`
- Create: `apps/api/test/jest-e2e.json`
- Create: `apps/api/test/widgets.e2e-spec.ts`
- Create: `scripts/verify-api-integration.sh`
- Modify: `apps/api/src/app.module.ts` (import `WidgetsModule`)

**Interfaces:**
- Consumes: `ClerkAuthGuard` (Task 4, applied globally via `APP_GUARD` — no per-controller `@UseGuards` needed), `CurrentOrg` decorator (Task 4), `HateoasLinkDto` (Task 3), `defaultTokenMinter` (Task 4).
- Produces: `Widget` entity, `WidgetsService.{create,findAll,findOne}`, `POST /v1/widgets`, `GET /v1/widgets`, `GET /v1/widgets/:id` — the reference shape Task 6's contract generation reads and Task 8's web client calls.

- [ ] **Step 1: Write `apps/api/src/entities/widget.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('widgets')
@Index(['organizationId'])
export class Widget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', length: 120 })
  organizationId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Write `apps/api/src/migrations/20260927120000-InitialSchema.ts`**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema20260927120000 implements MigrationInterface {
  name = 'InitialSchema20260927120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "widgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" varchar(120) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_widgets" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_widgets_organization_id" ON "widgets" ("organization_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "widgets";`);
  }
}
```

- [ ] **Step 3: Write `apps/api/src/widgets/create-widget.dto.ts`**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWidgetDto {
  @ApiProperty({ example: 'My first widget', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Optional longer description' })
  @IsOptional()
  @IsString()
  description?: string;
}
```

- [ ] **Step 4: Write `apps/api/src/widgets/widget-response.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { HateoasLinkDto } from '../common/dto/hateoas-link.dto';
import { Widget } from '../entities/widget.entity';

class WidgetLinksDto {
  @ApiProperty({ type: HateoasLinkDto })
  self: HateoasLinkDto;

  @ApiProperty({ type: HateoasLinkDto })
  collection: HateoasLinkDto;
}

export class WidgetResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'My first widget' })
  name: string;

  @ApiProperty({ example: 'Optional longer description', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-09-27T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-27T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: WidgetLinksDto })
  _links: WidgetLinksDto;

  static fromEntity(widget: Widget): WidgetResponseDto {
    const dto = new WidgetResponseDto();
    dto.id = widget.id;
    dto.name = widget.name;
    dto.description = widget.description;
    dto.createdAt = widget.createdAt.toISOString();
    dto.updatedAt = widget.updatedAt.toISOString();
    dto._links = {
      self: { href: `/v1/widgets/${widget.id}` },
      collection: { href: '/v1/widgets' },
    };
    return dto;
  }
}
```

- [ ] **Step 5: Write `apps/api/src/widgets/widgets.service.spec.ts`** (TDD: write and run failing before Step 7)

```typescript
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WidgetsService } from './widgets.service';
import { Widget } from '../entities/widget.entity';

describe('WidgetsService', () => {
  let service: WidgetsService;
  const repo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        WidgetsService,
        { provide: getRepositoryToken(Widget), useValue: repo },
      ],
    }).compile();
    service = module.get(WidgetsService);
  });

  it('creates a widget scoped to the organization', async () => {
    repo.create.mockReturnValue({
      organizationId: 'org_1',
      name: 'Test',
      description: null,
    });
    repo.save.mockResolvedValue({
      id: '1',
      organizationId: 'org_1',
      name: 'Test',
      description: null,
    });

    const result = await service.create('org_1', { name: 'Test' });

    expect(repo.create).toHaveBeenCalledWith({
      organizationId: 'org_1',
      name: 'Test',
      description: null,
    });
    expect(result.id).toBe('1');
  });

  it('lists only widgets belonging to the organization', async () => {
    repo.find.mockResolvedValue([{ id: '1', organizationId: 'org_1' }]);

    const result = await service.findAll('org_1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { organizationId: 'org_1' },
      order: { createdAt: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });

  it('throws NotFoundException for a widget outside the caller organization', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne('org_1', 'missing-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'missing-id', organizationId: 'org_1' },
    });
  });
});
```

- [ ] **Step 6: Run the spec and confirm it fails** (no implementation yet)

```bash
yarn jest widgets/widgets.service.spec.ts --runInBand
```

Expected: FAIL with "Cannot find module './widgets.service'".

- [ ] **Step 7: Write `apps/api/src/widgets/widgets.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Widget } from '../entities/widget.entity';
import { CreateWidgetDto } from './create-widget.dto';

@Injectable()
export class WidgetsService {
  constructor(
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateWidgetDto,
  ): Promise<Widget> {
    const widget = this.widgetRepository.create({
      organizationId,
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.widgetRepository.save(widget);
  }

  async findAll(organizationId: string): Promise<Widget[]> {
    return this.widgetRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<Widget> {
    const widget = await this.widgetRepository.findOne({
      where: { id, organizationId },
    });
    if (!widget) {
      throw new NotFoundException(`Widget ${id} not found`);
    }
    return widget;
  }
}
```

- [ ] **Step 8: Run the spec again and confirm it passes**

```bash
yarn jest widgets/widgets.service.spec.ts --runInBand
```

Expected: 3 passing tests.

- [ ] **Step 9: Write `apps/api/src/widgets/widgets.swagger.ts`**

```typescript
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WidgetResponseDto } from './widget-response.dto';
import {
  NotFoundResponse,
  UnauthorizedResponse,
  ValidationResponse,
} from '../swagger/common-responses';

export function WidgetsControllerSwagger() {
  return applyDecorators(
    ApiTags('widgets'),
    ApiBearerAuth('bearer'),
    UnauthorizedResponse(),
  );
}

export function CreateWidgetSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a widget' }),
    ApiCreatedResponse({ type: WidgetResponseDto }),
    ValidationResponse(),
  );
}

export function ListWidgetsSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'List widgets for the current organization' }),
    ApiOkResponse({ type: [WidgetResponseDto] }),
  );
}

export function GetWidgetSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a widget by id' }),
    ApiOkResponse({ type: WidgetResponseDto }),
    NotFoundResponse('Widget not found'),
  );
}
```

- [ ] **Step 10: Write `apps/api/src/widgets/widgets.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentOrg } from '../common/decorators/current-org.decorator';
import { CreateWidgetDto } from './create-widget.dto';
import { WidgetResponseDto } from './widget-response.dto';
import { WidgetsService } from './widgets.service';
import {
  CreateWidgetSwagger,
  GetWidgetSwagger,
  ListWidgetsSwagger,
  WidgetsControllerSwagger,
} from './widgets.swagger';

@Controller('widgets')
@WidgetsControllerSwagger()
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Post()
  @CreateWidgetSwagger()
  async create(
    @CurrentOrg() organizationId: string,
    @Body() dto: CreateWidgetDto,
  ): Promise<WidgetResponseDto> {
    const widget = await this.widgetsService.create(organizationId, dto);
    return WidgetResponseDto.fromEntity(widget);
  }

  @Get()
  @ListWidgetsSwagger()
  async findAll(
    @CurrentOrg() organizationId: string,
  ): Promise<WidgetResponseDto[]> {
    const widgets = await this.widgetsService.findAll(organizationId);
    return widgets.map((widget) => WidgetResponseDto.fromEntity(widget));
  }

  @Get(':id')
  @GetWidgetSwagger()
  async findOne(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WidgetResponseDto> {
    const widget = await this.widgetsService.findOne(organizationId, id);
    return WidgetResponseDto.fromEntity(widget);
  }
}
```

- [ ] **Step 11: Write `apps/api/src/widgets/widgets.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Widget } from '../entities/widget.entity';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Widget])],
  controllers: [WidgetsController],
  providers: [WidgetsService],
})
export class WidgetsModule {}
```

- [ ] **Step 12: Modify `apps/api/src/app.module.ts`** — add the import and register `WidgetsModule`

```typescript
import { WidgetsModule } from './widgets/widgets.module';
```

and add `WidgetsModule` to the `imports` array (after the
`TypeOrmModule.forRootAsync` entry).

- [ ] **Step 13: Write `apps/api/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

- [ ] **Step 14: Write `apps/api/test/widgets.e2e-spec.ts`** (this is the Review Focus check for cross-organization access — write and run against a real Postgres before considering the task done)

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { defaultTokenMinter } from './fixtures/token-minter';

describe('Widgets (e2e)', () => {
  let app: INestApplication;
  const orgAToken = defaultTokenMinter.mintOrgToken('user_a', 'org_a');
  const orgBToken = defaultTokenMinter.mintOrgToken('user_b', 'org_b');

  beforeAll(async () => {
    process.env.CLERK_JWT_KEY = defaultTokenMinter.publicKey;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates and retrieves a widget scoped to the caller organization', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/v1/widgets')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: 'Integration widget' })
      .expect(201);

    expect(createResponse.body.name).toBe('Integration widget');

    const listResponse = await request(app.getHttpServer())
      .get('/v1/widgets')
      .set('Authorization', `Bearer ${orgAToken}`)
      .expect(200);

    expect(
      listResponse.body.some(
        (w: { id: string }) => w.id === createResponse.body.id,
      ),
    ).toBe(true);
  });

  it('returns 404 for a widget belonging to a different organization', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/v1/widgets')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: 'Org A only' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/widgets/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${orgBToken}`)
      .expect(404);
  });

  it('rejects requests without a bearer token', async () => {
    await request(app.getHttpServer()).get('/v1/widgets').expect(401);
  });
});
```

- [ ] **Step 15: Write `scripts/verify-api-integration.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${VERIFICATION_DATABASE_URL:-}" ]]; then
  echo "VERIFICATION_DATABASE_URL must target an isolated test database" >&2
  exit 1
fi

database_name="${VERIFICATION_DATABASE_URL%%\?*}"
database_name="${database_name##*/}"
if [[ ! "${database_name}" =~ (test|e2e|ci) ]]; then
  echo "VERIFICATION_DATABASE_URL database name must contain test, e2e, or ci" >&2
  exit 1
fi

export DATABASE_URL="${VERIFICATION_DATABASE_URL}"
export NODE_ENV="${NODE_ENV:-test}"
export CLERK_SECRET_KEY="${CLERK_SECRET_KEY:-sk_test_placeholder}"
export CLIENT_ORIGINS="${CLIENT_ORIGINS:-http://localhost:{{ web_port }}}"

yarn migration:run
yarn test:api-e2e --runInBand
```

- [ ] **Step 16: Run the API-integration test against a real database**

```bash
docker compose -f docker-compose.test.yml up -d
until docker compose -f docker-compose.test.yml exec -T postgres pg_isready -h 127.0.0.1 -p 5434 >/dev/null 2>&1; do sleep 0.2; done
VERIFICATION_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5434/repo_template_selfcheck_test" scripts/verify-api-integration.sh
docker compose -f docker-compose.test.yml down -v
```

(Substitute the actual `postgres_port` and database name for the answers
used when this repo was generated for local testing — `5434` and
`{{ project_name | replace("-", "_") }}_test` are the template defaults.)
Expected: `yarn migration:run` reports the migration applied; all 3
`widgets.e2e-spec.ts` tests pass.

- [ ] **Step 17: Commit**

```bash
git add apps/api/src/entities/widget.entity.ts apps/api/src/migrations apps/api/src/widgets apps/api/test apps/api/src/app.module.ts scripts/verify-api-integration.sh
git commit -m "feat: add widgets example module with unit and API-integration tests"
```

---

### Task 6: API-contract generation

**Files:**
- Create: `scripts/generate-api-contract.ts`

**Interfaces:**
- Consumes: `AppModule` (Tasks 3/4/5), Swagger metadata on `WidgetResponseDto`/`CreateWidgetDto` (Task 5).
- Produces: `apps/web/src/types/api-contract.ts` (generated file, written by running this script, not hand-authored) with an exported `components['schemas']['WidgetResponseDto']` type, consumed by Task 8's web API client.

- [ ] **Step 1: Write `scripts/generate-api-contract.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.CLERK_SECRET_KEY =
  process.env.CLERK_SECRET_KEY || 'sk_test_placeholder';
process.env.CLIENT_ORIGINS =
  process.env.CLIENT_ORIGINS || 'http://localhost:{{ web_port }}';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '{{ postgres_port }}';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.DB_NAME =
  process.env.DB_NAME || '{{ project_name | replace("-", "_") }}';

import { DataSource } from 'typeorm';
import { ObjectUtils } from 'typeorm/util/ObjectUtils';

// Generating the contract only needs Nest's DI graph and Swagger metadata,
// not a live database connection — stub TypeORM's connect/disconnect so
// AppModule can be instantiated without Postgres running.
DataSource.prototype.initialize = async function () {
  ObjectUtils.assign(this, { isInitialized: true });
  return this;
};

DataSource.prototype.destroy = async function () {
  ObjectUtils.assign(this, { isInitialized: false });
};

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../apps/api/src/app.module';

async function generateApiContract(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('{{ project_name }} API')
    .setDescription('{{ project_description }}')
    .setVersion('1.0')
    .addServer('/v1', 'Version 1')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const openApiJsonPath = path.resolve(__dirname, '../openapi.json');
  fs.writeFileSync(openApiJsonPath, JSON.stringify(document, null, 2));

  const { execSync } = await import('child_process');
  const outputPath = path.resolve(
    __dirname,
    '../apps/web/src/types/api-contract.ts',
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  execSync(`npx openapi-typescript ${openApiJsonPath} -o ${outputPath}`, {
    stdio: 'inherit',
  });
  fs.unlinkSync(openApiJsonPath);

  await app.close();
  process.exit(0);
}

generateApiContract().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the generator and confirm the `Widget` schema is present**

```bash
yarn generate:api-contract
grep "WidgetResponseDto" apps/web/src/types/api-contract.ts
```

Expected: the script exits `0`; `apps/web/src/types/api-contract.ts`
exists and the `grep` finds the generated `WidgetResponseDto` schema type.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-api-contract.ts apps/web/src/types/api-contract.ts
git commit -m "feat: add OpenAPI-to-TypeScript contract generation"
```

---

### Task 7: Web skeleton & Clerk middleware

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/vitest.setup.ts`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/middleware.spec.ts`
- Create: `apps/web/src/lib/utils.ts`

**Interfaces:**
- Consumes: `web_port`/`api_port` prompts (Task 1). Does not yet import `apps/web/src/types/api-contract.ts` (Task 6) — that happens in Task 8.
- Produces: `Providers` (wraps `QueryClientProvider`, consumed by `layout.tsx` and reusable by Task 8's pages), Clerk `middleware.ts` protecting all non-public routes — the shape Task 8's `/widgets` route relies on for auth.

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port {{ web_port }}",
    "build": "next build",
    "start": "next start --port {{ web_port }}",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@clerk/localizations": "^4.16.0",
    "@clerk/nextjs": "^7.9.1",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-slot": "^1.1.2",
    "@tanstack/react-query": "^5.66.9",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.475.0",
    "next": "^15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@next/eslint-plugin-next": "15.5.25",
    "@tailwindcss/postcss": "^4.3.3",
    "@testing-library/dom": "10.4.1",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.3.0",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "^22.13.9",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint-plugin-react": "7.37.5",
    "eslint-plugin-react-hooks": "5.2.0",
    "jsdom": "26.1.0",
    "postcss": "^8.5.3",
    "tailwindcss": "^4.0.9",
    "typescript": "^5.8.2",
    "vitest": "3.2.6"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "jsx": "preserve",
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    },
    "allowJs": true,
    "noEmit": true,
    "isolatedModules": true,
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "types": [
      "vitest/globals",
      "@testing-library/jest-dom"
    ],
    "strict": false,
    "resolveJsonModule": true
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

- [ ] **Step 3: Write `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};

export default nextConfig;
```

- [ ] **Step 4: Write `apps/web/postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

- [ ] **Step 5: Write `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
});
```

- [ ] **Step 6: Write `apps/web/vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Write `apps/web/src/app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Write `apps/web/src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Write `apps/web/src/app/providers.tsx`**

```tsx
'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [ ] **Step 10: Write `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '{{ project_name }}',
  description: '{{ project_description }}',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <ClerkProvider>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 11: Write `apps/web/src/app/page.tsx`**

```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{{ project_name }}</h1>
      <p className="mt-2">
        <Link href="/widgets" className="underline">
          Go to widgets
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 12: Write `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`**

```tsx
import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return <SignIn />;
}
```

- [ ] **Step 13: Write `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`**

```tsx
import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return <SignUp />;
}
```

- [ ] **Step 14: Write `apps/web/src/middleware.ts`**

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

- [ ] **Step 15: Write `apps/web/src/middleware.spec.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { createRouteMatcher } from '@clerk/nextjs/server';

describe('isPublicRoute', () => {
  const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

  it('treats the home page as public', () => {
    expect(isPublicRoute({ nextUrl: { pathname: '/' } } as never)).toBe(true);
  });

  it('treats /sign-in and its sub-paths as public', () => {
    expect(
      isPublicRoute({ nextUrl: { pathname: '/sign-in/factor-one' } } as never),
    ).toBe(true);
  });

  it('treats /widgets as protected', () => {
    expect(isPublicRoute({ nextUrl: { pathname: '/widgets' } } as never)).toBe(
      false,
    );
  });
});
```

- [ ] **Step 16: Run the web unit tests and type-check**

```bash
yarn --cwd apps/web test
yarn tsc -p apps/web/tsconfig.json --noEmit
```

Expected: 3 passing tests in `middleware.spec.ts`; no type errors.

- [ ] **Step 17: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/vitest.config.ts apps/web/vitest.setup.ts apps/web/src/app apps/web/src/middleware.ts apps/web/src/middleware.spec.ts apps/web/src/lib/utils.ts
git commit -m "feat: add Next.js web skeleton with Clerk middleware"
```

---

### Task 8: Web widgets feature

**Files:**
- Create: `apps/web/src/lib/api/client.ts`
- Create: `apps/web/src/lib/api/widgets.ts`
- Create: `apps/web/src/hooks/use-widgets.ts`
- Create: `apps/web/src/hooks/use-widgets.spec.tsx`
- Create: `apps/web/src/app/widgets/page.tsx`

**Interfaces:**
- Consumes: `components['schemas']['WidgetResponseDto']` from `apps/web/src/types/api-contract.ts` (Task 6); `useAuth` from `@clerk/nextjs` (Task 7's `ClerkProvider` makes this available at runtime); `Providers`/`api_port` (Task 7).
- Produces: `useWidgets()` / `useCreateWidget()` hooks and the `/widgets` page, with `data-testid="widget-list"` — the surface Task 10's Playwright e2e spec drives.

- [ ] **Step 1: Write `apps/web/src/lib/api/client.ts`**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:{{ api_port }}';

export async function apiFetch<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 2: Write `apps/web/src/lib/api/widgets.ts`**

```typescript
import { apiFetch } from './client';
import type { components } from '../../types/api-contract';

export type Widget = components['schemas']['WidgetResponseDto'];

export function listWidgets(token: string | null): Promise<Widget[]> {
  return apiFetch<Widget[]>('/widgets', token);
}

export function createWidget(
  token: string | null,
  input: { name: string; description?: string },
): Promise<Widget> {
  return apiFetch<Widget>('/widgets', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 3: Write `apps/web/src/hooks/use-widgets.spec.tsx`** (TDD: write and run failing before Step 4)

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWidgets } from './use-widgets';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useWidgets', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', name: 'Test widget' }],
    }) as unknown as typeof fetch;
  });

  it('fetches widgets using the Clerk token', async () => {
    const { result } = renderHook(() => useWidgets(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([{ id: '1', name: 'Test widget' }]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/widgets'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });
});
```

- [ ] **Step 4: Run the spec and confirm it fails** (no implementation yet)

```bash
yarn --cwd apps/web vitest run use-widgets.spec.tsx
```

Expected: FAIL with "Cannot find module './use-widgets'".

- [ ] **Step 5: Write `apps/web/src/hooks/use-widgets.ts`**

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createWidget, listWidgets, type Widget } from '../lib/api/widgets';

export function useWidgets() {
  const { getToken } = useAuth();
  return useQuery<Widget[]>({
    queryKey: ['widgets'],
    queryFn: async () => listWidgets(await getToken()),
  });
}

export function useCreateWidget() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) =>
      createWidget(await getToken(), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
    },
  });
}
```

- [ ] **Step 6: Run the spec again and confirm it passes**

```bash
yarn --cwd apps/web vitest run use-widgets.spec.tsx
```

Expected: 1 passing test.

- [ ] **Step 7: Write `apps/web/src/app/widgets/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useCreateWidget, useWidgets } from '../../hooks/use-widgets';

export default function WidgetsPage() {
  const { data: widgets, isLoading } = useWidgets();
  const createWidget = useCreateWidget();
  const [name, setName] = useState('');

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Widgets</h1>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          createWidget.mutate({ name });
          setName('');
        }}
      >
        <input
          className="border rounded px-2 py-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Widget name"
        />
        <button type="submit" className="border rounded px-3 py-1">
          Create
        </button>
      </form>
      {isLoading ? (
        <p className="mt-4">Loading…</p>
      ) : (
        <ul className="mt-4" data-testid="widget-list">
          {widgets?.map((widget) => (
            <li key={widget.id}>{widget.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 8: Type-check the whole web app**

```bash
yarn tsc -p apps/web/tsconfig.json --noEmit
```

Expected: no type errors (this is the step that proves
`components['schemas']['WidgetResponseDto']`, generated in Task 6, has
the shape `widgets.ts`/`use-widgets.ts` expect).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/api apps/web/src/hooks apps/web/src/app/widgets
git commit -m "feat: add widgets web feature (API client, hook, page)"
```

---

### Task 9: Verify pipeline & CI

**Files:**
- Create: `scripts/verify.sh`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: every `yarn verify:*` script from Task 1's `package.json`; `docker-compose.test.yml` (Task 2).
- Produces: `scripts/verify.sh` (the single local entry point described in `README.md`, Task 11) and the CI workflow that runs the same checks on every push/PR.

- [ ] **Step 1: Write `scripts/verify.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

export VERIFICATION_DATABASE_URL="${VERIFICATION_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:{{ postgres_port }}/{{ project_name | replace("-", "_") }}_test}"

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  docker compose -f docker-compose.test.yml down -v >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

docker compose -f docker-compose.test.yml up -d
until docker compose -f docker-compose.test.yml exec -T postgres pg_isready -h 127.0.0.1 -p {{ postgres_port }} >/dev/null 2>&1; do
  sleep 0.2
done

yarn verify:lint
yarn verify:api-contract
yarn verify:type:api
yarn verify:type:web
yarn verify:test:api-unit
yarn verify:test:web-unit
yarn verify:test:api-integration
yarn verify:test:e2e
yarn verify:build:api
yarn verify:build:web
yarn verify:audit:production
```

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: verify
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
env:
  NODE_VERSION: '22'
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version: '22' }
      - run: yarn install --frozen-lockfile
      - run: yarn verify:lint
      - run: yarn verify:api-contract
      - run: yarn verify:type:api
      - run: yarn verify:type:web
      - run: yarn verify:test:api-unit
      - run: yarn verify:test:web-unit
      - run: yarn verify:build:api
      - run: yarn verify:build:web
      - run: yarn verify:audit:production
  api-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: {{ project_name | replace("-", "_") }}_ci
        ports: ['{{ postgres_port }}:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 2s --health-timeout 2s --health-retries 30
    env:
      VERIFICATION_DATABASE_URL: postgresql://postgres:postgres@localhost:{{ postgres_port }}/{{ project_name | replace("-", "_") }}_ci
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version: '22' }
      - run: yarn install --frozen-lockfile
      - run: yarn verify:test:api-integration
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: {{ project_name | replace("-", "_") }}_e2e
        ports: ['{{ postgres_port }}:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 2s --health-timeout 2s --health-retries 30
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:{{ postgres_port }}/{{ project_name | replace("-", "_") }}_e2e
      CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version: '22' }
      - run: yarn install --frozen-lockfile
      - run: yarn migration:run
      - run: npx playwright install --with-deps chromium
      - run: yarn test:e2e
```

Note: the `e2e` job requires `CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY`
GitHub Actions secrets configured on the generated repo (see
`docs/POST_CREATE.md`, Task 11) — it fails on a freshly generated repo
until those secrets are set. That is expected, not a bug in this
workflow; document it, don't work around it.

- [ ] **Step 3: Run the full local verify pipeline once, end to end**

```bash
scripts/verify.sh
```

Expected: every step listed in `scripts/verify.sh` prints its own success
output and the script exits `0`. `verify:test:e2e` requires the Clerk
test credentials from Task 10's setup — if they are not yet configured
when this step runs, report that gap explicitly (do not report a false
pass) and re-run this step once Task 10's credentials are in place.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify.sh .github/workflows/ci.yml
git commit -m "feat: add local verify pipeline and CI workflow"
```

---

### Task 10: End-to-end test with `@clerk/testing`

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/global.setup.ts`
- Create: `e2e/widgets.spec.ts`
- Create: `e2e/README.md`

**Interfaces:**
- Consumes: `web_port`/`api_port`/`postgres_port` prompts; the `/widgets` page and `data-testid="widget-list"` element from Task 8; `CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` env vars for a **test** Clerk application (project-specific, set up per Task 11's post-create checklist, not part of the template's own files).

- [ ] **Step 1: Write `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

const webOrigin = `http://localhost:{{ web_port }}`;
const apiOrigin = `http://localhost:{{ api_port }}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'clerk-setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['clerk-setup'],
    },
  ],
  webServer: [
    {
      command: 'yarn start:dev',
      url: `${apiOrigin}/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        PORT: '{{ api_port }}',
        DATABASE_URL:
          process.env.DATABASE_URL ||
          `postgresql://postgres:postgres@127.0.0.1:{{ postgres_port }}/{{ project_name | replace("-", "_") }}_test`,
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
        CLIENT_ORIGINS: webOrigin,
      },
    },
    {
      command:
        'sh -c "test -d apps/web/.next || yarn --cwd apps/web build" && yarn --cwd apps/web start',
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_URL: apiOrigin,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || '',
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
      },
    },
  ],
});
```

- [ ] **Step 2: Write `e2e/global.setup.ts`**

```typescript
import { clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';

setup.describe.configure({ mode: 'serial' });

setup('global clerk setup', async () => {
  await clerkSetup();
});
```

- [ ] **Step 3: Write `e2e/widgets.spec.ts`**

```typescript
import { clerk } from '@clerk/testing/playwright';
import { test, expect } from '@playwright/test';

test('signed-in user creates a widget', async ({ page }) => {
  await page.goto('/');

  await clerk.signIn({
    page,
    emailAddress:
      process.env.E2E_CLERK_USER_EMAIL || 'e2e+clerk_test@example.com',
  });

  await page.goto('/widgets');
  await page.getByPlaceholder('Widget name').fill('Playwright widget');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByTestId('widget-list')).toContainText(
    'Playwright widget',
  );
});
```

- [ ] **Step 4: Write `e2e/README.md`**

```markdown
# E2E tests

Requires a Clerk **test** application — its own instance per generated
project, never shared with another project's credentials — and one
seeded test user whose email uses the `+clerk_test@` alias so Clerk
auto-verifies sign-in without sending a real email or SMS. See
https://clerk.com/docs/guides/development/testing/playwright/overview.

## Setup

1. Create a Clerk application (or a test instance of an existing one) and
   set `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` (the `pk_test_...` /
   `sk_test_...` pair) in `.env`.
2. In that Clerk instance, create a user with an email like
   `e2e+clerk_test@example.com` (or set `E2E_CLERK_USER_EMAIL` to match a
   different seeded user).
3. Start the database: `docker compose -f docker-compose.test.yml up -d`
4. Run migrations: `yarn migration:run`

## Running

```bash
yarn test:e2e
```
```

- [ ] **Step 5: Validate the spec compiles and Playwright can list it** (running the full authenticated flow requires the real Clerk test credentials from Step 4, external to this repo and owned by whoever generates a project from this template; this step proves the test is wired correctly without those credentials existing yet)

```bash
npx playwright test --list
```

Expected: `playwright test --list` prints `clerk-setup > e2e/global.setup.ts`
and `chromium > e2e/widgets.spec.ts` with no syntax/import errors. Once a
real Clerk test application and seeded user are configured (per
`e2e/README.md`), re-run `yarn test:e2e` for the full green pass and
record that output as the completion evidence for this task.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "feat: add Playwright e2e test using @clerk/testing"
```

---

### Task 11: Template self-check & final docs

**Files:**
- Create: `scripts/verify-template.sh`
- Create: `README.md`
- Create: `docs/architecture/system-architecture.md`
- Create: `docs/POST_CREATE.md`

**Interfaces:**
- Consumes: every file from Tasks 1–10 (this is the task that proves the whole template generates a working project end to end).
- Produces: the maintainer-facing self-check referenced by `TEMPLATE.md` (Task 1) and the generated project's own `README.md`/`docs/`.

- [ ] **Step 1: Write `scripts/verify-template.sh`** (template-only, excluded from generated projects via Task 1's `copier.yml`)

```bash
#!/usr/bin/env bash
set -euo pipefail

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

copier copy . "${tmp_dir}/generated" \
  --data project_name=template-selfcheck \
  --data project_description="Template self-check project" \
  --defaults

cd "${tmp_dir}/generated"
yarn install --frozen-lockfile
yarn verify:lint
yarn verify:type:api
yarn verify:type:web
yarn verify:test:api-unit
yarn verify:test:web-unit
```

- [ ] **Step 2: Write `docs/POST_CREATE.md`**

```markdown
# Post-Create Checklist

Manual steps after generating a project from this template — these
require external accounts/decisions Copier cannot fill in.

1. **Clerk application.** Create a Clerk application for this project
   (separate test and production instances). Set `CLERK_SECRET_KEY` /
   `CLERK_PUBLISHABLE_KEY` in `.env` and as secrets in your CI provider.
   Never reuse another project's Clerk credentials.
2. **Clerk e2e test user.** Follow `e2e/README.md` to seed a
   `+clerk_test@` test user in the same Clerk **test** instance, and add
   `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` as repository secrets so
   the `e2e` CI job (`.github/workflows/ci.yml`) can run.
3. **CORS origins.** Set `CLIENT_ORIGINS` to your actual web origin(s).
4. **First real module.** Replace or delete the `widgets` example module
   (`apps/api/src/widgets/`, `apps/web/src/app/widgets/`,
   `apps/web/src/hooks/use-widgets.ts`, `apps/web/src/lib/api/widgets.ts`,
   the `widgets` migration) once you add your project's first real domain
   module — it exists only to prove the module pattern end to end.
5. **Architecture doc.** Fill in the "Domain Model" section of
   `docs/architecture/system-architecture.md` with your project's actual
   entities and tenancy rules.
6. **Hosting/deploy.** Set up your own deployment pipeline — this
   template deliberately ships none (see the design spec's Non-Goals).
```

- [ ] **Step 3: Write `docs/architecture/system-architecture.md`**

````markdown
# {{ project_name }} — System Architecture

## 1. Overview

{{ project_description }}

```
+-------------------------------------------------------------+
|                        CLIENT LAYER                          |
|  Next.js App Router (React 19, TypeScript, Tailwind CSS)     |
+------------------------------+--------------------------------+
                               | HTTPS / REST (`/v1/...`)
                               v
+-------------------------------------------------------------+
|                   API GATEWAY & BACKEND                      |
|   NestJS 11 (Express 5, Modular Architecture, Clerk Auth)    |
+------------------------------+--------------------------------+
                               | TypeORM (manual migrations)
                               v
+-------------------------------------------------------------+
|                     PERSISTENCE LAYER                         |
|              PostgreSQL 16 (relational schema)                |
+-------------------------------------------------------------+
```

## 2. Monorepo Structure

```
{{ project_name }}/
├── apps/
│   ├── api/                     # NestJS 11 backend
│   │   └── src/
│   │       ├── main.ts          # Bootstrap (prefix v1, swagger, pino)
│   │       ├── app.module.ts    # Root module
│   │       ├── auth/            # Clerk JWT guard
│   │       ├── common/          # Exceptions filter, decorators, DTOs
│   │       ├── swagger/         # Swagger setup & common responses
│   │       ├── entities/        # TypeORM entities
│   │       ├── migrations/      # Manual TypeORM migrations
│   │       └── widgets/         # Example domain module (see below)
│   └── web/                     # Next.js App Router frontend
├── docker-compose.yml           # Local dev services
├── Dockerfile                   # Node 22 Alpine
├── ormconfig.ts                 # TypeORM CLI DataSource configuration
├── scripts/verify.sh            # Local verify pipeline entry point
└── package.json
```

## 3. Domain Module Pattern

Each domain module is a flat, cohesive directory:
- `<domain>.controller.ts`: thin controller delegating to the service.
- `<domain>.service.ts`: business logic, org-scoped by `organizationId`.
- `<domain>.module.ts`: NestJS module registering the entity/providers.
- `<domain>.swagger.ts`: composed Swagger decorators.
- `create-<entity>.dto.ts` / `<entity>-response.dto.ts`: validated input
  / hypermedia-linked output.
- `*.spec.ts`: unit tests against a mocked repository.

`apps/api/src/widgets/` is the reference implementation of this pattern —
see `docs/POST_CREATE.md` for when/how to replace it.

## 4. Domain Model

_Fill in this section with your project's actual entities and tenancy
rules once you replace the `widgets` example (see `docs/POST_CREATE.md`,
item 5)._

## 5. API Design Standards

- Global prefix: `/v1`.
- Auth: `Authorization: Bearer <Clerk JWT>` on every non-`@Public()`
  route; `ClerkAuthGuard` attaches `req.orgId` from the token's `org_id`
  claim (falling back to `user_<sub>` for individual accounts).
- Responses include `_links` (HATEOAS) where useful for client
  discoverability — see `WidgetResponseDto` for the pattern; not
  mandatory for every resource.
- Structured JSON logging via Pino, tagged `service: "{{ service_log_name }}"`.
````

- [ ] **Step 4: Write `README.md`**

```markdown
# {{ project_name }}

{{ project_description }}

Generated from
[repo-template-nestjs-next](https://github.com/nuno-morais/repo-template-nestjs-next).
To pull a later template fix into this repo: `copier update` (see that
template's `TEMPLATE.md`).

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

```bash
cp .env.example .env   # fill in your own Clerk keys
docker compose up -d
yarn install
yarn migration:run
yarn start:dev          # API on http://localhost:{{ api_port }}
yarn --cwd apps/web dev # Web on http://localhost:{{ web_port }}
```

- API: `http://localhost:{{ api_port }}/v1`
- Swagger: `http://localhost:{{ api_port }}/docs`
- Postgres: `localhost:{{ postgres_port }}`

## Verification

```bash
scripts/verify.sh
```

Runs lint, type-check, unit tests, API-integration test, Playwright e2e,
build, and a dependency audit — see `.github/workflows/ci.yml` for the
CI equivalent.

## Documentation References

- [System Architecture](docs/architecture/system-architecture.md)
- [Post-Create Checklist](docs/POST_CREATE.md)
- [E2E Test Setup](e2e/README.md)
```

- [ ] **Step 5: Run the template self-check**

```bash
chmod +x scripts/verify-template.sh
scripts/verify-template.sh
```

Expected: Copier generates a throwaway project, `yarn install` succeeds,
and `verify:lint`/`verify:type:api`/`verify:type:web`/
`verify:test:api-unit`/`verify:test:web-unit` all pass inside it — this
is the proof that the template, end to end, generates a project that
actually works, not just one that compiles in-place.

- [ ] **Step 6: Confirm `copier update` applies cleanly on an unmodified generation** (proves the update path from spec §5.2/§9 actually works before tagging v1)

```bash
tmp_dir="$(mktemp -d)"
copier copy . "${tmp_dir}/update-check" \
  --data project_name=update-check --data project_description=x --defaults --vcs-ref HEAD
cd "${tmp_dir}/update-check" && git init -q && git add -A && git commit -q -m "initial generation"
cd - >/dev/null
cd "${tmp_dir}/update-check" && copier update --vcs-ref HEAD --defaults
```

Expected: `copier update` reports no changes (the generation is already
at the current template ref) and exits `0` with no conflict markers.

- [ ] **Step 7: Tag the initial template release**

```bash
git add scripts/verify-template.sh README.md docs/architecture/system-architecture.md docs/POST_CREATE.md
git commit -m "docs: add generated-project README, architecture doc, and post-create checklist"
git tag v1
```

- [ ] **Step 8: Push the repo and tag**

Create the GitHub repository (`gh repo create nuno-morais/repo-template-nestjs-next --private --source=. --remote=origin` or via the GitHub UI, then `git remote add origin <url>`), then:

```bash
git push -u origin main
git push origin v1
```

---

## Plan Self-Review

**Spec coverage:** §1 goal (start from a working skeleton) — Tasks 1–10
generate a project that actually runs and passes its own tests (Task 11
proves it via `verify-template.sh`). §2 scope (single Copier template,
`casamento-simples` baseline) — Task 1. §3 template contents — monorepo
layout (Tasks 1–2), API skeleton/auth/persistence (Tasks 3–5), API
contract generation (Task 6), verify pipeline/CI (Task 9), docs (Task 11).
§4 non-goals — no shared package (nothing in this plan creates one), no
enforced web framework beyond this template (only Next.js is built), no
deploy automation (Task 9's CI has no deploy job; Task 11's checklist
says so explicitly). §5 Copier mechanism — Task 1 (`copier.yml`,
`_exclude`, prompts), Task 11 Step 6 (`copier update` verified). §6
testing — generated project's own e2e (Task 10) and template self-check
(Task 11 Step 1/5). §7 post-create checklist — Task 11 Step 2. §8 data
flow/error handling — Task 3 (`AllExceptionsFilter`)/Task 5 (org-scoped
repository queries). §9 evolution path — no task extracts a package;
consistent.

**Placeholder scan:** no TBD/TODO in any step; every code block is
complete, runnable content, not a description of what to write.

**Type consistency:** `WidgetResponseDto`/`Widget`/`CreateWidgetDto`
names and shapes match across Tasks 5, 6, and 8. `CurrentOrg()` returns
`string` (Task 4) and is consumed as `organizationId: string` everywhere
in Task 5. `ClerkAuthGuard` sets `request.orgId`/`request.user` (Task 4)
and `CurrentOrg`/`CurrentUser` read exactly those properties (Task 4).
`{{ postgres_port }}`/`{{ api_port }}`/`{{ web_port }}` are used
consistently across Tasks 1, 2, 5, 6, 9, 10 — no task introduces a second,
conflicting default.

**Review Focus:** all five items each have an owning task and a test
listed above the item, per the Review Focus section — none are
aspirational.

---

**Plan complete and saved to
`docs/superpowers/plans/2026-09-27-repo-template-nestjs-next.md`.**
Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** — a fresh subagent implements each task and a
  fresh reviewer checks it before the next one starts, then a
  whole-branch review at the end. Most thorough; costs a fresh context
  per task and per review.
- **Native** — I implement every task myself in this session, then one
  fresh reviewer on the most capable model checks the whole branch.
  Cheapest and fastest; no independent review until the end.

For this plan I recommend **subagent-driven**, because the 11 tasks
build on each other's exact interfaces (guard → decorators → widgets →
contract → web hooks), several introduce a genuine simplification versus
the `casamento-simples` reference (the auth guard, the verify pipeline
scope) that benefits from a fresh reviewer catching drift per task
rather than only at the end, and a shipped mistake here gets copied into
every future project generated from this template.
