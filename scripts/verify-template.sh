#!/usr/bin/env bash
set -euo pipefail

root_dir="$(pwd)"

# Source root .env if present for credentials
if [ -f "${root_dir}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${root_dir}/.env"
  set +a
fi

static_only=0
if [ "${STATIC_ONLY:-0}" = "1" ] || [ "${1:-}" = "--static-only" ]; then
  static_only=1
fi

CLERK_PUBLISHABLE_KEY="${CLERK_PUBLISHABLE_KEY:-${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}}"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-${CLERK_PUBLISHABLE_KEY}}"
export CLERK_PUBLISHABLE_KEY NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

if [ "${static_only}" -eq 0 ]; then
  if [ -z "${CLERK_PUBLISHABLE_KEY}" ] || [ -z "${CLERK_SECRET_KEY:-}" ]; then
    echo "Error: CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY required for template self-check." >&2
    echo "Spec §6 requires full verification (DB integration + authenticated Playwright e2e)." >&2
    echo "Set Clerk test keys in .env or pass --static-only to opt into static verification only." >&2
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker daemon not running." >&2
    echo "Spec §6 requires full verification (DB integration + authenticated Playwright e2e)." >&2
    echo "Start Docker daemon or pass --static-only to opt into static verification only." >&2
    exit 1
  fi
fi

docker_started=0
tmp_dir="$(mktemp -d)"

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  if [ "${docker_started}" -eq 1 ] && [ -f "${tmp_dir}/generated/docker-compose.test.yml" ]; then
    docker compose -f "${tmp_dir}/generated/docker-compose.test.yml" down -v
  fi
  rm -rf "${tmp_dir}"
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

echo "Generating test project from template..."
copier copy --vcs-ref HEAD . "${tmp_dir}/generated" \
  --data project_name=template-selfcheck \
  --data project_description="Template self-check project" \
  --defaults

cd "${tmp_dir}/generated"

echo "Installing dependencies in generated project..."
if [ -f "${root_dir}/yarn.lock" ] && [ -f "yarn.lock" ]; then
  yarn install --frozen-lockfile
else
  yarn install
fi

echo "Running static verification and unit tests..."
yarn verify:lint
yarn verify:type:api
yarn verify:type:web
yarn verify:test:api-unit
yarn verify:test:web-unit

if [ "${static_only}" -eq 1 ]; then
  echo "Notice: Bypassed database and authenticated e2e verification via --static-only flag."
  echo "Static template self-check complete."
  exit 0
fi

echo "Running database integration tests..."
export VERIFICATION_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5435/template_selfcheck_test"
export DATABASE_URL="${VERIFICATION_DATABASE_URL}"
docker compose -f docker-compose.test.yml up -d
docker_started=1
retries=30
ready=0
while [ "${retries}" -gt 0 ]; do
  if docker compose -f docker-compose.test.yml exec -T postgres pg_isready -h 127.0.0.1 -p 5434 >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
  retries=$((retries - 1))
done

if [ "${ready}" -eq 0 ]; then
  echo "Error: Timed out waiting for test PostgreSQL container readiness." >&2
  exit 1
fi

yarn verify:test:api-integration
yarn migration:run

echo "Running authenticated Playwright e2e tests..."
npx playwright install --with-deps chromium
yarn verify:test:e2e


echo "Full template self-check complete."
