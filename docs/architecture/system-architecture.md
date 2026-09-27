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
|   NestJS 12 (Express 5, Modular Architecture, Clerk Auth)    |
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
│   ├── api/                     # NestJS 12 backend
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
- `create-<entity>.dto.ts` / `<entity>-response.dto.ts`: validated input / hypermedia-linked output.
- `*.spec.ts`: unit tests against a mocked repository.

`apps/api/src/widgets/` is the reference implementation of this pattern — see `docs/POST_CREATE.md` for when/how to replace it.

## 4. Domain Model

_Fill in this section with your project's actual entities and tenancy rules once you replace the `widgets` example (see `docs/POST_CREATE.md`, item 5)._

## 5. API Design Standards

- Global prefix: `/v1`.
- Auth: `Authorization: Bearer <Clerk JWT>` on every non-`@Public()` route; `ClerkAuthGuard` attaches `req.orgId` from the token's `org_id` claim (falling back to `user_<sub>` for individual accounts).
- Responses include `_links` (HATEOAS) where useful for client discoverability — see `WidgetResponseDto` for the pattern; not mandatory for every resource.
- Structured JSON logging via Pino, tagged `service: "{{ service_log_name }}"`.
