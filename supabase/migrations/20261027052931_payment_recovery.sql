-- Apply the sandbox statement first. Only atc1989 applies the doctors statement.
-- Nullable/additive: old code keeps working during rollout. No customer data backfill.
alter table sandbox.shop_orders add column if not exists maya_checkout_url text;
alter table doctors.shop_orders add column if not exists maya_checkout_url text;
