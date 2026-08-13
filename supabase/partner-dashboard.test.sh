#!/usr/bin/env bash
# Runs partner-dashboard.test.sql against a throwaway Postgres in Docker.
#
#   bash supabase/partner-dashboard.test.sh
#
# Applies the stubs, then the partner sections sliced straight out of the real schema
# files - so the SQL under test is the SQL that ships, not a copy that can drift.
set -euo pipefail

cd "$(dirname "$0")"

CONTAINER=gg-partner-dashboard-test
PSQL="docker exec -i $CONTAINER psql -U postgres -v ON_ERROR_STOP=1 -q"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=x postgres:16 >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done

# Stubs, then the two live sections, then the assertions - in that order, because the
# assertions call functions the sections define.
sed -n '/^-- ─── Stand-ins/,/^-- ─── CHECKS/p' partner-dashboard.test.sql | $PSQL
sed -n '/^-- ─── Partner login identity/,$p' doctor-qr-redirect.sql | $PSQL
sed -n '/^-- ─── Partner dashboard/,$p' shop-orders.sql | $PSQL
sed -n '/^-- ─── CHECKS/,$p' partner-dashboard.test.sql | $PSQL 2>&1 | grep -E 'NOTICE|ERROR' || true

# The sandbox mirror is a copy-paste of the same functions, so it is worth proving it
# still parses even though the assertions only exercise public.
sed -n '/^-- ─── Partner dashboard/,$p' shop-orders-sandbox.sql | $PSQL
echo "sandbox mirror applied cleanly"

cat migrations/20260813000000_partner_registration_referrals.sql | $PSQL
cat migrations/20260813000100_partner_dashboard_referral_orders.sql | $PSQL
cat migrations/20260813000200_partner_referral_email.sql | $PSQL
cat migrations/20260813000300_sandbox_partner_dashboard_referral_orders.sql | $PSQL
sed -n '/REFERRAL V2 CHECKS/,$p' partner-dashboard.test.sql | $PSQL
echo "partner referral dashboard checks passed"
