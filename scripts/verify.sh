#!/usr/bin/env bash
set -euo pipefail

# Load environment file if present (without overriding existing exports)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
fi

# Ensure Clerk credentials for authenticated e2e verification
CLERK_PUBLISHABLE_KEY="${CLERK_PUBLISHABLE_KEY:-${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}}"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-${CLERK_PUBLISHABLE_KEY}}"
export CLERK_PUBLISHABLE_KEY NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

if [ -z "${CLERK_PUBLISHABLE_KEY}" ] || [ -z "${CLERK_SECRET_KEY:-}" ]; then
  echo "Error: CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY required for authenticated Playwright e2e." >&2
  echo "Prerequisites missing: no fake green when keys absent." >&2
  echo "Configure Clerk test keys in .env or environment before running verify.sh." >&2
  exit 1
fi

export VERIFICATION_DATABASE_URL="${VERIFICATION_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:{{ postgres_port + 1 }}/{{ project_name | replace("-", "_") }}_test}"
export DATABASE_URL="${DATABASE_URL:-${VERIFICATION_DATABASE_URL}}"

# Manage test postgres via Docker if VERIFICATION_DATABASE_URL points to localhost default
managed_docker=0
if [[ "${VERIFICATION_DATABASE_URL}" == *"127.0.0.1:{{ postgres_port + 1 }}"* ]] || [[ "${VERIFICATION_DATABASE_URL}" == *"localhost:{{ postgres_port + 1 }}"* ]]; then
  if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker daemon not running and test database not available." >&2
    echo "Prerequisites missing: Docker required for isolated test postgres container." >&2
    exit 1
  fi
  managed_docker=1
fi

if [ "${managed_docker}" -eq 1 ]; then
  cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM
    docker compose -f docker-compose.test.yml down -v
    exit "${exit_code}"
  }
  trap cleanup EXIT INT TERM

  docker compose -f docker-compose.test.yml up -d
  retries=30
  ready=0
  while [ "${retries}" -gt 0 ]; do
    if docker compose -f docker-compose.test.yml exec -T postgres pg_isready -h 127.0.0.1 -p {{ postgres_port }} >/dev/null 2>&1; then
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
fi

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
