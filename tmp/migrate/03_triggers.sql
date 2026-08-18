
CREATE OR REPLACE TRIGGER doctor_registrations_referrer_immutable
BEFORE UPDATE OF referred_by_partner_id ON doctors.doctor_registrations
FOR EACH ROW EXECUTE FUNCTION doctors.prevent_partner_referrer_change();

CREATE OR REPLACE TRIGGER doctor_registrations_touch_updated_at
BEFORE UPDATE ON doctors.doctor_registrations
FOR EACH ROW EXECUTE FUNCTION doctors.touch_updated_at();

CREATE OR REPLACE TRIGGER shop_orders_touch_updated_at
BEFORE UPDATE ON doctors.shop_orders
FOR EACH ROW EXECUTE FUNCTION doctors.touch_shop_order_updated_at();

CREATE OR REPLACE TRIGGER touch_tiktok_credentials_updated_at
BEFORE UPDATE ON doctors.tiktok_credentials
FOR EACH ROW EXECUTE FUNCTION doctors.touch_tiktok_credentials_updated_at();

CREATE OR REPLACE TRIGGER shop_orders_touch_updated_at
BEFORE UPDATE ON sandbox.shop_orders
FOR EACH ROW EXECUTE FUNCTION sandbox.touch_shop_order_updated_at();
