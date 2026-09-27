#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${VERIFICATION_DATABASE_URL:-}" ]]; then
  echo "VERIFICATION_DATABASE_URL must target an isolated test database" >&2
  exit 1
fi
database_name="${VERIFICATION_DATABASE_URL%%\?*}"
database_name="${database_name##*/}"
if [[ ! "${VERIFICATION_DATABASE_URL}" =~ ^postgres(ql)?:// ]] || [[ ! "${database_name}" =~ ^[a-zA-Z0-9_]+_(test|e2e|ci)$ ]]; then
  echo "VERIFICATION_DATABASE_URL must be PostgreSQL and name an isolated _test, _e2e, or _ci database" >&2
  exit 1
fi
export DATABASE_URL="${VERIFICATION_DATABASE_URL}"
export NODE_ENV=test
export CLERK_SECRET_KEY="${CLERK_SECRET_KEY:-sk_test_placeholder}"
export CLIENT_ORIGINS="${CLIENT_ORIGINS:-http://localhost:{{ web_port }}}"
yarn migration:run
yarn test:api-e2e
