#!/usr/bin/env bash
# Applies 20261007000000 + 20261008000000 to a copy of the live prod structure and runs the
# release checks. Uses a throwaway Postgres in Docker, or an existing server via PSQL, e.g.
#
#   bash supabase/release-reconciliation.test.sh
#   PSQL="psql -h /tmp -p 54399 -U postgres" bash supabase/release-reconciliation.test.sh
set -euo pipefail
cd "$(dirname "$0")"

DB=gg_release_check
if [[ -z "${PSQL:-}" ]]; then
  CONTAINER=gg-release-check
  cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
  trap cleanup EXIT
  cleanup
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=x postgres:16 >/dev/null
  for _ in $(seq 1 60); do docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
  PSQL="docker exec -i $CONTAINER psql -U postgres"
fi

$PSQL -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { $PSQL -d "$DB" -q -v ON_ERROR_STOP=1 "$@"; }
# The baseline creates anon/authenticated/service_role; ignore "already exists" on a reused server.
$PSQL -d "$DB" -q -v ON_ERROR_STOP=0 < baseline/20261008_prod_doctors_sandbox.sql 2>&1 | grep -v 'already exists' | grep ERROR && exit 1 || true
run < migrations/20261007000000_add_doctor_where_did_you_find_us.sql
run < migrations/20261008000000_release_reconciliation.sql
run < migrations/20261008000000_release_reconciliation.sql   # must be re-runnable
run -tA < release-reconciliation.test.sql
