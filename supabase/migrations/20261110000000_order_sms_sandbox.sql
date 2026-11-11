-- Order SMS on sandbox.shop_orders: the send-once log and the checkout verification codes.
-- Run this sandbox file first; the doctors file is production (atc1989 only).
--
-- shop_order_sms_sends is the sibling of shop_order_email_sends. One row per order, kind and
-- number, so a replayed Maya webhook or an admin marking the same order paid cannot text the
-- customer twice. Its own table rather than a row in shop_order_email_sends: that table's
-- `email` column is NOT NULL and a mobile number is not an email address.
--
-- shop_mobile_otps holds one code per order, as a hash, for the checkout gate in
-- /api/maya/checkout. Nothing here ever stores the code itself.
--
-- Additive and re-runnable, no DROP.

create table if not exists sandbox.shop_order_sms_sends (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references sandbox.shop_orders(id) on delete cascade,
  mobile text not null,
  kind text not null,
  status text not null,
  provider text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz not null default now(),
  constraint shop_order_sms_sends_status_check check (status in ('sent', 'failed', 'skipped'))
);

create index if not exists shop_order_sms_sends_order_id_idx
  on sandbox.shop_order_sms_sends using btree (order_id, sent_at desc);

-- The send-once guarantee. The function also checks before sending, so this is the backstop for
-- two callers racing: the loser's insert fails instead of both counting as sent.
create unique index if not exists shop_order_sms_sends_once_idx
  on sandbox.shop_order_sms_sends using btree (order_id, kind, mobile)
  where status = 'sent';

create table if not exists sandbox.shop_mobile_otps (
  order_id uuid primary key references sandbox.shop_orders(id) on delete cascade,
  mobile text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only the server's service-role key reads or writes these; RLS is on with no policies.
-- This schema's default privileges hand every new table to anon and authenticated, so the grant
-- has to be taken back explicitly: these two tables hold customer mobile numbers and the hashes
-- that let a payment through.
alter table sandbox.shop_order_sms_sends enable row level security;
revoke all on table sandbox.shop_order_sms_sends from public, anon, authenticated;
grant select, insert on table sandbox.shop_order_sms_sends to service_role;

alter table sandbox.shop_mobile_otps enable row level security;
revoke all on table sandbox.shop_mobile_otps from public, anon, authenticated;
grant select, insert, update on table sandbox.shop_mobile_otps to service_role;

notify pgrst, 'reload schema';
