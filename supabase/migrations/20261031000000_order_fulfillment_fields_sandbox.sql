-- Order fulfilment fields + sales channel on sandbox.shop_orders. Additive and re-runnable.
-- Run the sandbox file first; the doctors file is production (atc1989 only).
--
-- Admin → Orders enters and edits these on every order (Maya included): order time, proof of
-- payment/funds (POF) time, courier tracking number, pick-up time, tracking status, the bot
-- message (free-text note) and the salesperson. sales_channel = 'store' for orders an admin
-- adds through Add order, 'online' for shop checkout. The admin_* order RPCs return
-- SETOF shop_orders with select *, so they pick the new columns up without changes.

alter table sandbox.shop_orders add column if not exists order_time timestamptz;
alter table sandbox.shop_orders add column if not exists pof_time timestamptz;
alter table sandbox.shop_orders add column if not exists tracking_number text;
alter table sandbox.shop_orders add column if not exists pickup_time timestamptz;
alter table sandbox.shop_orders add column if not exists tracking_status text;
alter table sandbox.shop_orders add column if not exists bot_message text;
alter table sandbox.shop_orders add column if not exists salesperson text;
alter table sandbox.shop_orders add column if not exists sales_channel text not null default 'online';

-- Added only when missing, so the file stays re-runnable without dropping anything.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_orders_tracking_status_check'
                 and conrelid = 'sandbox.shop_orders'::regclass) then
    alter table sandbox.shop_orders add constraint shop_orders_tracking_status_check
      check (tracking_status is null or tracking_status in
        ('preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'returned'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shop_orders_sales_channel_check'
                 and conrelid = 'sandbox.shop_orders'::regclass) then
    alter table sandbox.shop_orders add constraint shop_orders_sales_channel_check
      check (sales_channel in ('online', 'store'));
  end if;
end $$;

-- Consignment/cash only ever come from Admin → Add order (checkout is Maya only).
update sandbox.shop_orders set sales_channel = 'store'
where payment_method in ('consignment', 'cash') and sales_channel <> 'store';
