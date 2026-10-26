#!/usr/bin/env bash
# Runs partner-wallet.test.sql against a throwaway Postgres in Docker:
#
#   bash supabase/partner-wallet.test.sh
#
# Stubs, then the real migration, then the checks - so the SQL under test is the SQL that ships.
set -euo pipefail

cd "$(dirname "$0")"

CONTAINER=gg-partner-wallet-test
PSQL="docker exec -i $CONTAINER psql -U postgres -v ON_ERROR_STOP=1 -q"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=x postgres:16 >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done

sed -n '1,/^-- ─── CHECKS/p' partner-wallet.test.sql | $PSQL
$PSQL < migrations/20261030000000_partner_wallet.sql
# Twice: the migration must be safe to re-run.
$PSQL < migrations/20261030000000_partner_wallet.sql
sed -n '/^-- ─── CHECKS/,$p' partner-wallet.test.sql | $PSQL 2>&1 | grep -E 'NOTICE|ERROR'
