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

Generates throwaway project with default answers and runs full verification
including DB and authenticated e2e (`--static-only` for lint, type-check,
and unit tests without Docker/credentials). Run before tagging release.
