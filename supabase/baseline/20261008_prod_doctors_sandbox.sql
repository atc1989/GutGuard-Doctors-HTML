-- Live structure of the `doctors` and `sandbox` schemas on the production project (GutGuard Life Style),
-- captured 2026-10-08 before 20261007000000 / 20261008000000. Structure only, no rows.
-- Used by release-reconciliation.test.sh; also the reference for 'supabase migration repair'.

-- Minimal Supabase surface for testing doctors/sandbox migrations locally.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions; create schema doctors; create schema sandbox;
create extension if not exists pgcrypto with schema extensions;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create or replace function auth.email() returns text language sql stable as
$$ select auth.jwt()->>'email' $$;
grant usage on schema auth, doctors, sandbox, public, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

CREATE TYPE doctors.store_type AS ENUM ('affiliate', 'lifestyle', 'main');
CREATE TYPE sandbox.store_type AS ENUM ('affiliate', 'lifestyle', 'main');
CREATE TYPE public.store_type AS ENUM ('affiliate', 'lifestyle', 'main');
CREATE SEQUENCE IF NOT EXISTS doctors.prizes_id_seq;
CREATE TABLE doctors.admin_impersonation_log (id uuid DEFAULT gen_random_uuid() NOT NULL, doctor_id uuid, doctor_email text NOT NULL, source_ip text DEFAULT ''::text NOT NULL, user_agent text DEFAULT ''::text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.doctor_registrations (id uuid DEFAULT gen_random_uuid() NOT NULL, full_name text NOT NULL, email text NOT NULL, mobile text NOT NULL, specialty text NOT NULL, practice_location text NOT NULL, task_email_received boolean DEFAULT false NOT NULL, task_facebook_followed boolean DEFAULT false NOT NULL, task_tiktok_followed boolean DEFAULT false NOT NULL, task_reel_created boolean DEFAULT false NOT NULL, prize_label text, prize_note text, prize_claimed_at timestamp with time zone, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, tiktok_username text, routing_slug text NOT NULL, redirect_url text, referred_by_partner_id uuid, name_prefix text DEFAULT ''::text NOT NULL, store_type doctors.store_type DEFAULT 'affiliate'::doctors.store_type NOT NULL, main_store_id uuid, referral_qr_enabled boolean DEFAULT false NOT NULL, promoted_at timestamp with time zone, promoted_by text);
CREATE TABLE doctors.doctor_sequence_enrollments (id uuid DEFAULT gen_random_uuid() NOT NULL, doctor_id uuid NOT NULL, current_step integer DEFAULT 0 NOT NULL, status text DEFAULT 'active'::text NOT NULL, enrolled_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.email_sequence_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, enrollment_id uuid NOT NULL, doctor_id uuid NOT NULL, step_id uuid, sent_at timestamp with time zone DEFAULT now() NOT NULL, clicked_at timestamp with time zone, status text DEFAULT 'sent'::text NOT NULL);
CREATE TABLE doctors.email_sequence_steps (id uuid DEFAULT gen_random_uuid() NOT NULL, step_number integer NOT NULL, subject text NOT NULL, html_body text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, attachments jsonb DEFAULT '[]'::jsonb NOT NULL);
CREATE TABLE doctors.milestone_unlocks (id uuid DEFAULT gen_random_uuid() NOT NULL, partner_id uuid NOT NULL, cycle_number integer NOT NULL, milestone_pts integer NOT NULL, rebate_amount numeric NOT NULL, status character varying(50) DEFAULT 'unlocked'::character varying, created_at timestamp with time zone DEFAULT now());
CREATE TABLE doctors.newsletter_campaigns (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, subject text NOT NULL, html_template text NOT NULL, recipient_count integer DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.newsletter_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, doctor_id uuid, email text DEFAULT ''::text NOT NULL, subject text NOT NULL, status text NOT NULL, resend_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL, newsletter_id uuid);
CREATE TABLE doctors.partner_points (id uuid DEFAULT gen_random_uuid() NOT NULL, order_id uuid NOT NULL, partner_id uuid NOT NULL, points integer NOT NULL, depth integer NOT NULL, created_at timestamp with time zone DEFAULT now());
CREATE TABLE doctors.partner_referral_email_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, registration_id uuid NOT NULL, referrer_id uuid NOT NULL, recipient_email text NOT NULL, subject text NOT NULL, status text NOT NULL, resend_id text, error_message text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.partner_referral_email_settings (id smallint DEFAULT 1 NOT NULL, enabled boolean DEFAULT true NOT NULL, subject text DEFAULT 'A new partner registered through your GutGuard link'::text NOT NULL, reply_to text DEFAULT ''::text NOT NULL, body_text text DEFAULT ''::text NOT NULL, html_template text DEFAULT '<div></div>'::text NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.prizes (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, label text NOT NULL, note text NOT NULL, weight integer NOT NULL, color text NOT NULL, text_color text NOT NULL, active boolean DEFAULT true NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.referral_clicks (id uuid DEFAULT gen_random_uuid() NOT NULL, routing_slug text NOT NULL, doctor_id uuid, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.registration_email_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, registration_id uuid, email text DEFAULT ''::text NOT NULL, subject text DEFAULT ''::text NOT NULL, status text NOT NULL, resend_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.registration_email_settings (id smallint DEFAULT 1 NOT NULL, enabled boolean DEFAULT false NOT NULL, subject text DEFAULT ''::text NOT NULL, reply_to text DEFAULT ''::text NOT NULL, html_template text DEFAULT ''::text NOT NULL, attachments jsonb DEFAULT '[]'::jsonb NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, body_text text DEFAULT ''::text NOT NULL);
CREATE TABLE doctors.shop_order_email_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, order_id uuid, email text NOT NULL, subject text NOT NULL, status text NOT NULL, resend_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.shop_orders (id uuid DEFAULT gen_random_uuid() NOT NULL, order_code text NOT NULL, status text DEFAULT 'pending_payment'::text NOT NULL, payment_status text DEFAULT 'pending'::text NOT NULL, payment_method text DEFAULT 'maya'::text NOT NULL, maya_reference text, customer_name text NOT NULL, email text NOT NULL, mobile text NOT NULL, address text NOT NULL, city text NOT NULL, province text NOT NULL, zip text NOT NULL, subtotal numeric(12,2) DEFAULT 0 NOT NULL, items jsonb DEFAULT '[]'::jsonb NOT NULL, admin_notes text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, barangay text DEFAULT ''::text NOT NULL, province_code text, city_municipality_code text, barangay_code text, shipping_region text, shipping_fee numeric(12,2) DEFAULT 0 NOT NULL, shipping_weight_grams integer DEFAULT 0 NOT NULL, total_amount numeric(12,2) DEFAULT 0 NOT NULL, maya_checkout_id text, maya_payment_id text, maya_payment_status text, maya_request_reference text, maya_fund_source text, payment_attempts integer DEFAULT 0 NOT NULL, paid_at timestamp with time zone, first_name text, last_name text, referral_slug text, referral_doctor_id uuid);
CREATE TABLE doctors.sms_campaigns (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, message_template text NOT NULL, recipient_count integer DEFAULT 0 NOT NULL, provider text, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.sms_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, sms_campaign_id uuid, doctor_id uuid, mobile text DEFAULT ''::text NOT NULL, message text NOT NULL, status text NOT NULL, provider_message_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.store_promotions (id uuid DEFAULT gen_random_uuid() NOT NULL, partner_id uuid NOT NULL, from_type doctors.store_type NOT NULL, to_type doctors.store_type NOT NULL, trigger_type text NOT NULL, trigger_order_id uuid, trigger_admin_note text, created_at timestamp with time zone DEFAULT now());
CREATE TABLE doctors.testimonials (id uuid DEFAULT gen_random_uuid() NOT NULL, display_name text NOT NULL, email text NOT NULL, role_line text DEFAULT ''::text NOT NULL, story text NOT NULL, avatar_path text, photo_paths text[] DEFAULT '{}'::text[] NOT NULL, video_file_id text, consent boolean NOT NULL, status text DEFAULT 'pending'::text NOT NULL, featured boolean DEFAULT false NOT NULL, review_note text DEFAULT ''::text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, reviewed_at timestamp with time zone);
CREATE TABLE doctors.tiktok_credentials (id text DEFAULT 'default'::text NOT NULL, access_token text, refresh_token text NOT NULL, expires_at bigint DEFAULT 0 NOT NULL, refresh_token_expires_at bigint, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.wheel_admin_settings (id boolean DEFAULT true NOT NULL, admin_password text NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.wheel_claims (id uuid DEFAULT gen_random_uuid() NOT NULL, doctor_id uuid NOT NULL, prize_id uuid NOT NULL, prize_label_snapshot text NOT NULL, prize_note_snapshot text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE doctors.wheel_prizes (id uuid DEFAULT gen_random_uuid() NOT NULL, label text NOT NULL, note text DEFAULT ''::text NOT NULL, color text DEFAULT '#0608A9'::text NOT NULL, text_color text DEFAULT '#F4F1EA'::text NOT NULL, chance_weight integer DEFAULT 1 NOT NULL, total_stock integer DEFAULT 0 NOT NULL, remaining_stock integer DEFAULT 0 NOT NULL, is_active boolean DEFAULT true NOT NULL, sort_order integer DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE sandbox.milestone_unlocks (id uuid DEFAULT gen_random_uuid() NOT NULL, partner_id uuid NOT NULL, cycle_number integer NOT NULL, milestone_pts integer NOT NULL, rebate_amount numeric NOT NULL, status character varying(50) DEFAULT 'unlocked'::character varying, created_at timestamp with time zone DEFAULT now());
CREATE TABLE sandbox.partner_points (id uuid DEFAULT gen_random_uuid() NOT NULL, order_id uuid NOT NULL, partner_id uuid NOT NULL, points integer NOT NULL, depth integer NOT NULL, created_at timestamp with time zone DEFAULT now());
CREATE TABLE sandbox.referral_clicks (id uuid DEFAULT gen_random_uuid() NOT NULL, routing_slug text NOT NULL, doctor_id uuid, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE sandbox.shop_order_email_sends (id uuid DEFAULT gen_random_uuid() NOT NULL, order_id uuid, email text NOT NULL, subject text NOT NULL, status text NOT NULL, resend_id text, error_message text, sent_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE sandbox.shop_orders (id uuid DEFAULT gen_random_uuid() NOT NULL, order_code text NOT NULL, status text DEFAULT 'pending_payment'::text NOT NULL, payment_status text DEFAULT 'pending'::text NOT NULL, payment_method text DEFAULT 'maya'::text NOT NULL, maya_reference text, customer_name text NOT NULL, email text NOT NULL, mobile text NOT NULL, address text NOT NULL, city text NOT NULL, province text NOT NULL, barangay text DEFAULT ''::text NOT NULL, zip text NOT NULL, province_code text, city_municipality_code text, barangay_code text, shipping_region text, shipping_fee numeric(12,2) DEFAULT 0 NOT NULL, shipping_weight_grams integer DEFAULT 0 NOT NULL, total_amount numeric(12,2) DEFAULT 0 NOT NULL, subtotal numeric(12,2) DEFAULT 0 NOT NULL, items jsonb DEFAULT '[]'::jsonb NOT NULL, admin_notes text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, first_name text, last_name text, referral_slug text, referral_doctor_id uuid, maya_checkout_id text, maya_payment_id text, maya_payment_status text, maya_request_reference text, maya_fund_source text, payment_attempts integer DEFAULT 0 NOT NULL, paid_at timestamp with time zone, for_other boolean DEFAULT false NOT NULL, recipient_name text, recipient_mobile text);
CREATE TABLE sandbox.store_promotions (id uuid DEFAULT gen_random_uuid() NOT NULL, partner_id uuid NOT NULL, from_type sandbox.store_type NOT NULL, to_type sandbox.store_type NOT NULL, trigger_type text NOT NULL, trigger_order_id uuid, trigger_admin_note text, created_at timestamp with time zone DEFAULT now());
ALTER TABLE doctors.prizes ADD CONSTRAINT prizes_pkey PRIMARY KEY (id);
ALTER TABLE doctors.referral_clicks ADD CONSTRAINT referral_clicks_pkey PRIMARY KEY (id);
ALTER TABLE doctors.wheel_claims ADD CONSTRAINT wheel_claims_pkey PRIMARY KEY (id);
ALTER TABLE doctors.tiktok_credentials ADD CONSTRAINT tiktok_credentials_pkey PRIMARY KEY (id);
ALTER TABLE sandbox.shop_orders ADD CONSTRAINT shop_orders_pkey PRIMARY KEY (id);
ALTER TABLE doctors.doctor_sequence_enrollments ADD CONSTRAINT doctor_sequence_enrollments_pkey PRIMARY KEY (id);
ALTER TABLE doctors.newsletter_campaigns ADD CONSTRAINT newsletter_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE doctors.partner_referral_email_sends ADD CONSTRAINT partner_referral_email_sends_pkey PRIMARY KEY (id);
ALTER TABLE doctors.registration_email_settings ADD CONSTRAINT registration_email_settings_pkey PRIMARY KEY (id);
ALTER TABLE doctors.registration_email_sends ADD CONSTRAINT registration_email_sends_pkey PRIMARY KEY (id);
ALTER TABLE doctors.shop_orders ADD CONSTRAINT shop_orders_pkey PRIMARY KEY (id);
ALTER TABLE doctors.shop_order_email_sends ADD CONSTRAINT shop_order_email_sends_pkey PRIMARY KEY (id);
ALTER TABLE doctors.sms_campaigns ADD CONSTRAINT sms_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE doctors.sms_sends ADD CONSTRAINT sms_sends_pkey PRIMARY KEY (id);
ALTER TABLE doctors.wheel_admin_settings ADD CONSTRAINT wheel_admin_settings_pkey PRIMARY KEY (id);
ALTER TABLE doctors.wheel_prizes ADD CONSTRAINT wheel_prizes_pkey PRIMARY KEY (id);
ALTER TABLE doctors.newsletter_sends ADD CONSTRAINT newsletter_sends_pkey PRIMARY KEY (id);
ALTER TABLE doctors.email_sequence_steps ADD CONSTRAINT email_sequence_steps_pkey PRIMARY KEY (id);
ALTER TABLE doctors.email_sequence_sends ADD CONSTRAINT email_sequence_sends_pkey PRIMARY KEY (id);
ALTER TABLE doctors.partner_referral_email_settings ADD CONSTRAINT partner_referral_email_settings_pkey PRIMARY KEY (id);
ALTER TABLE sandbox.shop_order_email_sends ADD CONSTRAINT shop_order_email_sends_pkey PRIMARY KEY (id);
ALTER TABLE sandbox.referral_clicks ADD CONSTRAINT referral_clicks_pkey PRIMARY KEY (id);
ALTER TABLE doctors.doctor_registrations ADD CONSTRAINT doctor_registrations_pkey PRIMARY KEY (id);
ALTER TABLE doctors.testimonials ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);
ALTER TABLE doctors.admin_impersonation_log ADD CONSTRAINT admin_impersonation_log_pkey PRIMARY KEY (id);
ALTER TABLE sandbox.partner_points ADD CONSTRAINT partner_points_pkey PRIMARY KEY (id);
ALTER TABLE sandbox.milestone_unlocks ADD CONSTRAINT milestone_unlocks_pkey PRIMARY KEY (id);
ALTER TABLE doctors.partner_points ADD CONSTRAINT partner_points_pkey PRIMARY KEY (id);
ALTER TABLE doctors.milestone_unlocks ADD CONSTRAINT milestone_unlocks_pkey PRIMARY KEY (id);
ALTER TABLE doctors.store_promotions ADD CONSTRAINT store_promotions_pkey PRIMARY KEY (id);
ALTER TABLE sandbox.store_promotions ADD CONSTRAINT store_promotions_pkey PRIMARY KEY (id);
ALTER TABLE sandbox.partner_points ADD CONSTRAINT partner_points_order_id_partner_id_key UNIQUE (order_id, partner_id);
ALTER TABLE sandbox.milestone_unlocks ADD CONSTRAINT milestone_unlocks_partner_id_cycle_number_milestone_pts_key UNIQUE (partner_id, cycle_number, milestone_pts);
ALTER TABLE doctors.milestone_unlocks ADD CONSTRAINT milestone_unlocks_partner_id_cycle_number_milestone_pts_key UNIQUE (partner_id, cycle_number, milestone_pts);
ALTER TABLE doctors.partner_points ADD CONSTRAINT partner_points_order_id_partner_id_key UNIQUE (order_id, partner_id);
ALTER TABLE sandbox.partner_points ADD CONSTRAINT partner_points_depth_check CHECK ((depth = ANY (ARRAY[0, 1])));
ALTER TABLE doctors.shop_order_email_sends ADD CONSTRAINT shop_order_email_sends_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE doctors.sms_sends ADD CONSTRAINT sms_sends_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE doctors.wheel_admin_settings ADD CONSTRAINT wheel_admin_settings_id_check CHECK (id);
ALTER TABLE doctors.wheel_prizes ADD CONSTRAINT wheel_prizes_chance_weight_check CHECK ((chance_weight >= 0));
ALTER TABLE doctors.wheel_prizes ADD CONSTRAINT wheel_prizes_check CHECK ((remaining_stock <= total_stock));
ALTER TABLE doctors.wheel_prizes ADD CONSTRAINT wheel_prizes_remaining_stock_check CHECK ((remaining_stock >= 0));
ALTER TABLE doctors.wheel_prizes ADD CONSTRAINT wheel_prizes_total_stock_check CHECK ((total_stock >= 0));
ALTER TABLE doctors.newsletter_sends ADD CONSTRAINT newsletter_sends_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE doctors.email_sequence_sends ADD CONSTRAINT email_sequence_sends_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'clicked'::text])));
ALTER TABLE doctors.partner_referral_email_settings ADD CONSTRAINT partner_referral_email_settings_id_check CHECK ((id = 1));
ALTER TABLE doctors.partner_points ADD CONSTRAINT partner_points_depth_check CHECK ((depth = ANY (ARRAY[0, 1])));
ALTER TABLE sandbox.shop_order_email_sends ADD CONSTRAINT shop_order_email_sends_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE doctors.doctor_registrations ADD CONSTRAINT chk_main_store_no_parent CHECK (((store_type <> 'main'::doctors.store_type) OR (main_store_id IS NULL)));
ALTER TABLE doctors.doctor_registrations ADD CONSTRAINT chk_non_main_must_have_parent CHECK (((store_type = 'main'::doctors.store_type) OR (main_store_id IS NOT NULL)));
ALTER TABLE doctors.prizes ADD CONSTRAINT prizes_weight_check CHECK ((weight > 0));
ALTER TABLE doctors.tiktok_credentials ADD CONSTRAINT tiktok_credentials_id_check CHECK ((id = 'default'::text));
ALTER TABLE sandbox.shop_orders ADD CONSTRAINT shop_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'review'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE doctors.testimonials ADD CONSTRAINT testimonials_avatar_path_check CHECK (((avatar_path IS NULL) OR (avatar_path ~ '^[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp)$'::text)));
ALTER TABLE sandbox.shop_orders ADD CONSTRAINT shop_orders_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'payment_review'::text, 'paid'::text, 'confirmed'::text, 'cancelled'::text, 'fulfilled'::text])));
ALTER TABLE doctors.testimonials ADD CONSTRAINT testimonials_consent_check CHECK (consent);
ALTER TABLE doctors.doctor_sequence_enrollments ADD CONSTRAINT doctor_sequence_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text])));
ALTER TABLE doctors.testimonials ADD CONSTRAINT testimonials_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE doctors.partner_referral_email_sends ADD CONSTRAINT partner_referral_email_sends_status_check CHECK ((status = ANY (ARRAY['sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE doctors.registration_email_settings ADD CONSTRAINT registration_email_settings_id_check CHECK ((id = 1));
ALTER TABLE doctors.testimonials ADD CONSTRAINT testimonials_video_id_check CHECK (((video_file_id IS NULL) OR (video_file_id ~ '^[A-Za-z0-9_-]{20,200}$'::text)));
ALTER TABLE doctors.registration_email_sends ADD CONSTRAINT registration_email_sends_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text, 'test'::text])));
ALTER TABLE doctors.shop_orders ADD CONSTRAINT shop_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'review'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE doctors.shop_orders ADD CONSTRAINT shop_orders_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'payment_review'::text, 'paid'::text, 'confirmed'::text, 'cancelled'::text, 'fulfilled'::text])));
ALTER TABLE doctors.registration_email_sends ADD CONSTRAINT registration_email_sends_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.referral_clicks ADD CONSTRAINT referral_clicks_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.doctor_registrations ADD CONSTRAINT doctor_registrations_main_store_id_fkey FOREIGN KEY (main_store_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.wheel_claims ADD CONSTRAINT wheel_claims_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.partner_points ADD CONSTRAINT partner_points_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES doctors.doctor_registrations(id) ON DELETE CASCADE;
ALTER TABLE sandbox.partner_points ADD CONSTRAINT partner_points_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES doctors.doctor_registrations(id) ON DELETE CASCADE;
ALTER TABLE doctors.wheel_claims ADD CONSTRAINT wheel_claims_prize_id_fkey FOREIGN KEY (prize_id) REFERENCES doctors.wheel_prizes(id);
ALTER TABLE doctors.partner_referral_email_sends ADD CONSTRAINT partner_referral_email_sends_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.milestone_unlocks ADD CONSTRAINT milestone_unlocks_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES doctors.doctor_registrations(id) ON DELETE CASCADE;
ALTER TABLE doctors.doctor_registrations ADD CONSTRAINT doctor_registrations_referred_by_partner_id_fkey FOREIGN KEY (referred_by_partner_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.partner_referral_email_sends ADD CONSTRAINT partner_referral_email_sends_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.newsletter_sends ADD CONSTRAINT newsletter_sends_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.newsletter_sends ADD CONSTRAINT newsletter_sends_newsletter_id_fkey FOREIGN KEY (newsletter_id) REFERENCES doctors.newsletter_campaigns(id);
ALTER TABLE doctors.sms_sends ADD CONSTRAINT sms_sends_sms_campaign_id_fkey FOREIGN KEY (sms_campaign_id) REFERENCES doctors.sms_campaigns(id);
ALTER TABLE doctors.shop_orders ADD CONSTRAINT shop_orders_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE sandbox.milestone_unlocks ADD CONSTRAINT milestone_unlocks_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES doctors.doctor_registrations(id) ON DELETE CASCADE;
ALTER TABLE doctors.email_sequence_sends ADD CONSTRAINT email_sequence_sends_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.email_sequence_sends ADD CONSTRAINT email_sequence_sends_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES doctors.doctor_sequence_enrollments(id);
ALTER TABLE sandbox.store_promotions ADD CONSTRAINT store_promotions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES doctors.doctor_registrations(id) ON DELETE CASCADE;
ALTER TABLE sandbox.shop_orders ADD CONSTRAINT shop_orders_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.email_sequence_sends ADD CONSTRAINT email_sequence_sends_step_id_fkey FOREIGN KEY (step_id) REFERENCES doctors.email_sequence_steps(id) ON DELETE SET NULL;
ALTER TABLE doctors.shop_order_email_sends ADD CONSTRAINT shop_order_email_sends_order_id_fkey FOREIGN KEY (order_id) REFERENCES doctors.shop_orders(id);
ALTER TABLE doctors.doctor_sequence_enrollments ADD CONSTRAINT doctor_sequence_enrollments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE sandbox.shop_order_email_sends ADD CONSTRAINT shop_order_email_sends_order_id_fkey FOREIGN KEY (order_id) REFERENCES sandbox.shop_orders(id);
ALTER TABLE doctors.partner_points ADD CONSTRAINT partner_points_order_id_fkey FOREIGN KEY (order_id) REFERENCES doctors.shop_orders(id) ON DELETE CASCADE;
ALTER TABLE sandbox.partner_points ADD CONSTRAINT partner_points_order_id_fkey FOREIGN KEY (order_id) REFERENCES sandbox.shop_orders(id) ON DELETE CASCADE;
ALTER TABLE sandbox.referral_clicks ADD CONSTRAINT referral_clicks_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.sms_sends ADD CONSTRAINT sms_sends_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id);
ALTER TABLE doctors.admin_impersonation_log ADD CONSTRAINT admin_impersonation_log_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors.doctor_registrations(id) ON DELETE SET NULL;
ALTER TABLE doctors.store_promotions ADD CONSTRAINT store_promotions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES doctors.doctor_registrations(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX email_sequence_steps_step_number_key ON doctors.email_sequence_steps USING btree (step_number);
CREATE INDEX shop_orders_order_code_idx ON doctors.shop_orders USING btree (order_code);
CREATE UNIQUE INDEX sandbox_shop_orders_order_code_key ON sandbox.shop_orders USING btree (order_code);
CREATE INDEX doctor_registrations_referred_by_partner_id_idx ON doctors.doctor_registrations USING btree (referred_by_partner_id, created_at DESC);
CREATE INDEX testimonials_public_idx ON doctors.testimonials USING btree (status, featured DESC, created_at DESC);
CREATE INDEX admin_impersonation_log_recent_idx ON doctors.admin_impersonation_log USING btree (created_at DESC);
CREATE INDEX sandbox_referral_clicks_doctor_id_idx ON sandbox.referral_clicks USING btree (doctor_id, created_at DESC);
CREATE UNIQUE INDEX doctor_sequence_enrollments_doctor_id_key ON doctors.doctor_sequence_enrollments USING btree (doctor_id);
CREATE INDEX shop_orders_referral_doctor_id_idx ON doctors.shop_orders USING btree (referral_doctor_id, created_at DESC);
CREATE INDEX sandbox_shop_orders_created_at_idx ON sandbox.shop_orders USING btree (created_at DESC);
CREATE INDEX idx_store_promotions_partner ON doctors.store_promotions USING btree (partner_id);
CREATE INDEX shop_orders_created_at_idx ON doctors.shop_orders USING btree (created_at DESC);
CREATE INDEX sandbox_shop_orders_order_code_idx ON sandbox.shop_orders USING btree (order_code);
CREATE UNIQUE INDEX wheel_claims_doctor_id_key ON doctors.wheel_claims USING btree (doctor_id);
CREATE INDEX sandbox_shop_orders_referral_doctor_id_idx ON sandbox.shop_orders USING btree (referral_doctor_id, created_at DESC);
CREATE INDEX idx_doctors_milestone_unlocks_partner_id ON doctors.milestone_unlocks USING btree (partner_id);
CREATE INDEX idx_sandbox_milestone_unlocks_partner_id ON sandbox.milestone_unlocks USING btree (partner_id);
CREATE INDEX shop_orders_maya_payment_id_idx ON doctors.shop_orders USING btree (maya_payment_id);
CREATE INDEX testimonials_email_idx ON doctors.testimonials USING btree (email, created_at DESC);
CREATE INDEX sandbox_shop_orders_status_idx ON sandbox.shop_orders USING btree (status, payment_status);
CREATE INDEX sandbox_shop_order_email_sends_order_id_idx ON sandbox.shop_order_email_sends USING btree (order_id, sent_at DESC);
CREATE INDEX idx_sandbox_store_promotions_partner ON sandbox.store_promotions USING btree (partner_id);
CREATE UNIQUE INDEX partner_referral_email_one_success_idx ON doctors.partner_referral_email_sends USING btree (registration_id) WHERE (status = 'sent'::text);
CREATE INDEX idx_dr_main_store_type ON doctors.doctor_registrations USING btree (main_store_id, store_type);
CREATE INDEX sms_sends_doctor_id_sent_at_idx ON doctors.sms_sends USING btree (doctor_id, sent_at DESC);
CREATE INDEX referral_clicks_doctor_id_idx ON doctors.referral_clicks USING btree (doctor_id, created_at DESC);
CREATE UNIQUE INDEX doctor_registrations_link_key ON doctors.doctor_registrations USING btree ("right"((id)::text, 8));
CREATE INDEX doctor_registrations_email_idx ON doctors.doctor_registrations USING btree (lower(email));
CREATE INDEX sandbox_shop_orders_maya_payment_id_idx ON sandbox.shop_orders USING btree (maya_payment_id);
CREATE INDEX idx_sandbox_partner_points_partner_id ON sandbox.partner_points USING btree (partner_id);
CREATE INDEX shop_order_email_sends_order_id_idx ON doctors.shop_order_email_sends USING btree (order_id, sent_at DESC);
CREATE UNIQUE INDEX shop_orders_order_code_key ON doctors.shop_orders USING btree (order_code);
CREATE INDEX admin_impersonation_log_doctor_idx ON doctors.admin_impersonation_log USING btree (doctor_id, created_at DESC);
CREATE INDEX shop_orders_status_idx ON doctors.shop_orders USING btree (status, payment_status);
CREATE UNIQUE INDEX partner_referral_email_one_inflight_idx ON doctors.partner_referral_email_sends USING btree (registration_id) WHERE (status = 'sending'::text);
CREATE INDEX sms_sends_sms_campaign_id_idx ON doctors.sms_sends USING btree (sms_campaign_id);
CREATE UNIQUE INDEX doctor_registrations_link_key_5 ON doctors.doctor_registrations USING btree ("right"((id)::text, 5));
CREATE INDEX idx_dr_store_type ON doctors.doctor_registrations USING btree (store_type);
CREATE INDEX idx_dr_main_store_id ON doctors.doctor_registrations USING btree (main_store_id);
CREATE UNIQUE INDEX doctor_registrations_routing_slug_key ON doctors.doctor_registrations USING btree (routing_slug);
CREATE UNIQUE INDEX prizes_label_key ON doctors.prizes USING btree (label);
CREATE UNIQUE INDEX doctor_registrations_tiktok_username_unique ON doctors.doctor_registrations USING btree (lower(tiktok_username)) WHERE ((tiktok_username IS NOT NULL) AND (tiktok_username <> ''::text));
CREATE UNIQUE INDEX doctor_registrations_email_key ON doctors.doctor_registrations USING btree (email) WHERE (email <> ''::text);
CREATE INDEX idx_doctors_partner_points_partner_id ON doctors.partner_points USING btree (partner_id);
CREATE INDEX registration_email_sends_registration_id_idx ON doctors.registration_email_sends USING btree (registration_id);
CREATE UNIQUE INDEX wheel_prizes_label_key ON doctors.wheel_prizes USING btree (label);
CREATE INDEX registration_email_sends_sent_at_idx ON doctors.registration_email_sends USING btree (sent_at DESC);
ALTER TABLE doctors.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.wheel_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.tiktok_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.doctor_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.newsletter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.partner_referral_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.registration_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.registration_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.shop_order_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.sms_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.wheel_admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.wheel_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.newsletter_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.email_sequence_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.partner_referral_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.shop_order_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.doctor_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.admin_impersonation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.partner_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.milestone_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.partner_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.milestone_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors.store_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.store_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow reading active prizes" ON doctors.prizes AS PERMISSIVE FOR SELECT TO anon,authenticated USING ((active = true));
GRANT INSERT ON doctors.prizes TO anon;
GRANT SELECT ON doctors.prizes TO anon;
GRANT UPDATE ON doctors.prizes TO anon;
GRANT DELETE ON doctors.prizes TO anon;
GRANT TRUNCATE ON doctors.prizes TO anon;
GRANT REFERENCES ON doctors.prizes TO anon;
GRANT TRIGGER ON doctors.prizes TO anon;
GRANT INSERT ON doctors.prizes TO authenticated;
GRANT SELECT ON doctors.prizes TO authenticated;
GRANT UPDATE ON doctors.prizes TO authenticated;
GRANT DELETE ON doctors.prizes TO authenticated;
GRANT TRUNCATE ON doctors.prizes TO authenticated;
GRANT REFERENCES ON doctors.prizes TO authenticated;
GRANT TRIGGER ON doctors.prizes TO authenticated;
GRANT INSERT ON doctors.prizes TO service_role;
GRANT SELECT ON doctors.prizes TO service_role;
GRANT UPDATE ON doctors.prizes TO service_role;
GRANT DELETE ON doctors.prizes TO service_role;
GRANT TRUNCATE ON doctors.prizes TO service_role;
GRANT REFERENCES ON doctors.prizes TO service_role;
GRANT TRIGGER ON doctors.prizes TO service_role;
GRANT INSERT ON doctors.referral_clicks TO anon;
GRANT SELECT ON doctors.referral_clicks TO anon;
GRANT UPDATE ON doctors.referral_clicks TO anon;
GRANT DELETE ON doctors.referral_clicks TO anon;
GRANT TRUNCATE ON doctors.referral_clicks TO anon;
GRANT REFERENCES ON doctors.referral_clicks TO anon;
GRANT TRIGGER ON doctors.referral_clicks TO anon;
GRANT INSERT ON doctors.referral_clicks TO authenticated;
GRANT SELECT ON doctors.referral_clicks TO authenticated;
GRANT UPDATE ON doctors.referral_clicks TO authenticated;
GRANT DELETE ON doctors.referral_clicks TO authenticated;
GRANT TRUNCATE ON doctors.referral_clicks TO authenticated;
GRANT REFERENCES ON doctors.referral_clicks TO authenticated;
GRANT TRIGGER ON doctors.referral_clicks TO authenticated;
GRANT INSERT ON doctors.referral_clicks TO service_role;
GRANT SELECT ON doctors.referral_clicks TO service_role;
GRANT UPDATE ON doctors.referral_clicks TO service_role;
GRANT DELETE ON doctors.referral_clicks TO service_role;
GRANT TRUNCATE ON doctors.referral_clicks TO service_role;
GRANT REFERENCES ON doctors.referral_clicks TO service_role;
GRANT TRIGGER ON doctors.referral_clicks TO service_role;
GRANT INSERT ON doctors.wheel_claims TO anon;
GRANT SELECT ON doctors.wheel_claims TO anon;
GRANT UPDATE ON doctors.wheel_claims TO anon;
GRANT DELETE ON doctors.wheel_claims TO anon;
GRANT TRUNCATE ON doctors.wheel_claims TO anon;
GRANT REFERENCES ON doctors.wheel_claims TO anon;
GRANT TRIGGER ON doctors.wheel_claims TO anon;
GRANT INSERT ON doctors.wheel_claims TO authenticated;
GRANT SELECT ON doctors.wheel_claims TO authenticated;
GRANT UPDATE ON doctors.wheel_claims TO authenticated;
GRANT DELETE ON doctors.wheel_claims TO authenticated;
GRANT TRUNCATE ON doctors.wheel_claims TO authenticated;
GRANT REFERENCES ON doctors.wheel_claims TO authenticated;
GRANT TRIGGER ON doctors.wheel_claims TO authenticated;
GRANT INSERT ON doctors.wheel_claims TO service_role;
GRANT SELECT ON doctors.wheel_claims TO service_role;
GRANT UPDATE ON doctors.wheel_claims TO service_role;
GRANT DELETE ON doctors.wheel_claims TO service_role;
GRANT TRUNCATE ON doctors.wheel_claims TO service_role;
GRANT REFERENCES ON doctors.wheel_claims TO service_role;
GRANT TRIGGER ON doctors.wheel_claims TO service_role;
GRANT INSERT ON doctors.tiktok_credentials TO anon;
GRANT SELECT ON doctors.tiktok_credentials TO anon;
GRANT UPDATE ON doctors.tiktok_credentials TO anon;
GRANT DELETE ON doctors.tiktok_credentials TO anon;
GRANT TRUNCATE ON doctors.tiktok_credentials TO anon;
GRANT REFERENCES ON doctors.tiktok_credentials TO anon;
GRANT TRIGGER ON doctors.tiktok_credentials TO anon;
GRANT INSERT ON doctors.tiktok_credentials TO authenticated;
GRANT SELECT ON doctors.tiktok_credentials TO authenticated;
GRANT UPDATE ON doctors.tiktok_credentials TO authenticated;
GRANT DELETE ON doctors.tiktok_credentials TO authenticated;
GRANT TRUNCATE ON doctors.tiktok_credentials TO authenticated;
GRANT REFERENCES ON doctors.tiktok_credentials TO authenticated;
GRANT TRIGGER ON doctors.tiktok_credentials TO authenticated;
GRANT INSERT ON doctors.tiktok_credentials TO service_role;
GRANT SELECT ON doctors.tiktok_credentials TO service_role;
GRANT UPDATE ON doctors.tiktok_credentials TO service_role;
GRANT DELETE ON doctors.tiktok_credentials TO service_role;
GRANT TRUNCATE ON doctors.tiktok_credentials TO service_role;
GRANT REFERENCES ON doctors.tiktok_credentials TO service_role;
GRANT TRIGGER ON doctors.tiktok_credentials TO service_role;
GRANT INSERT ON sandbox.shop_orders TO anon;
GRANT SELECT ON sandbox.shop_orders TO anon;
GRANT UPDATE ON sandbox.shop_orders TO anon;
GRANT DELETE ON sandbox.shop_orders TO anon;
GRANT TRUNCATE ON sandbox.shop_orders TO anon;
GRANT REFERENCES ON sandbox.shop_orders TO anon;
GRANT TRIGGER ON sandbox.shop_orders TO anon;
GRANT INSERT ON sandbox.shop_orders TO authenticated;
GRANT SELECT ON sandbox.shop_orders TO authenticated;
GRANT UPDATE ON sandbox.shop_orders TO authenticated;
GRANT DELETE ON sandbox.shop_orders TO authenticated;
GRANT TRUNCATE ON sandbox.shop_orders TO authenticated;
GRANT REFERENCES ON sandbox.shop_orders TO authenticated;
GRANT TRIGGER ON sandbox.shop_orders TO authenticated;
GRANT INSERT ON sandbox.shop_orders TO service_role;
GRANT SELECT ON sandbox.shop_orders TO service_role;
GRANT UPDATE ON sandbox.shop_orders TO service_role;
GRANT DELETE ON sandbox.shop_orders TO service_role;
GRANT TRUNCATE ON sandbox.shop_orders TO service_role;
GRANT REFERENCES ON sandbox.shop_orders TO service_role;
GRANT TRIGGER ON sandbox.shop_orders TO service_role;
GRANT INSERT ON doctors.doctor_sequence_enrollments TO anon;
GRANT SELECT ON doctors.doctor_sequence_enrollments TO anon;
GRANT UPDATE ON doctors.doctor_sequence_enrollments TO anon;
GRANT DELETE ON doctors.doctor_sequence_enrollments TO anon;
GRANT TRUNCATE ON doctors.doctor_sequence_enrollments TO anon;
GRANT REFERENCES ON doctors.doctor_sequence_enrollments TO anon;
GRANT TRIGGER ON doctors.doctor_sequence_enrollments TO anon;
GRANT INSERT ON doctors.doctor_sequence_enrollments TO authenticated;
GRANT SELECT ON doctors.doctor_sequence_enrollments TO authenticated;
GRANT UPDATE ON doctors.doctor_sequence_enrollments TO authenticated;
GRANT DELETE ON doctors.doctor_sequence_enrollments TO authenticated;
GRANT TRUNCATE ON doctors.doctor_sequence_enrollments TO authenticated;
GRANT REFERENCES ON doctors.doctor_sequence_enrollments TO authenticated;
GRANT TRIGGER ON doctors.doctor_sequence_enrollments TO authenticated;
GRANT INSERT ON doctors.doctor_sequence_enrollments TO service_role;
GRANT SELECT ON doctors.doctor_sequence_enrollments TO service_role;
GRANT UPDATE ON doctors.doctor_sequence_enrollments TO service_role;
GRANT DELETE ON doctors.doctor_sequence_enrollments TO service_role;
GRANT TRUNCATE ON doctors.doctor_sequence_enrollments TO service_role;
GRANT REFERENCES ON doctors.doctor_sequence_enrollments TO service_role;
GRANT TRIGGER ON doctors.doctor_sequence_enrollments TO service_role;
GRANT INSERT ON doctors.newsletter_campaigns TO anon;
GRANT SELECT ON doctors.newsletter_campaigns TO anon;
GRANT UPDATE ON doctors.newsletter_campaigns TO anon;
GRANT DELETE ON doctors.newsletter_campaigns TO anon;
GRANT TRUNCATE ON doctors.newsletter_campaigns TO anon;
GRANT REFERENCES ON doctors.newsletter_campaigns TO anon;
GRANT TRIGGER ON doctors.newsletter_campaigns TO anon;
GRANT INSERT ON doctors.newsletter_campaigns TO authenticated;
GRANT SELECT ON doctors.newsletter_campaigns TO authenticated;
GRANT UPDATE ON doctors.newsletter_campaigns TO authenticated;
GRANT DELETE ON doctors.newsletter_campaigns TO authenticated;
GRANT TRUNCATE ON doctors.newsletter_campaigns TO authenticated;
GRANT REFERENCES ON doctors.newsletter_campaigns TO authenticated;
GRANT TRIGGER ON doctors.newsletter_campaigns TO authenticated;
GRANT INSERT ON doctors.newsletter_campaigns TO service_role;
GRANT SELECT ON doctors.newsletter_campaigns TO service_role;
GRANT UPDATE ON doctors.newsletter_campaigns TO service_role;
GRANT DELETE ON doctors.newsletter_campaigns TO service_role;
GRANT TRUNCATE ON doctors.newsletter_campaigns TO service_role;
GRANT REFERENCES ON doctors.newsletter_campaigns TO service_role;
GRANT TRIGGER ON doctors.newsletter_campaigns TO service_role;
GRANT INSERT ON doctors.partner_referral_email_sends TO anon;
GRANT SELECT ON doctors.partner_referral_email_sends TO anon;
GRANT UPDATE ON doctors.partner_referral_email_sends TO anon;
GRANT DELETE ON doctors.partner_referral_email_sends TO anon;
GRANT TRUNCATE ON doctors.partner_referral_email_sends TO anon;
GRANT REFERENCES ON doctors.partner_referral_email_sends TO anon;
GRANT TRIGGER ON doctors.partner_referral_email_sends TO anon;
GRANT INSERT ON doctors.partner_referral_email_sends TO authenticated;
GRANT SELECT ON doctors.partner_referral_email_sends TO authenticated;
GRANT UPDATE ON doctors.partner_referral_email_sends TO authenticated;
GRANT DELETE ON doctors.partner_referral_email_sends TO authenticated;
GRANT TRUNCATE ON doctors.partner_referral_email_sends TO authenticated;
GRANT REFERENCES ON doctors.partner_referral_email_sends TO authenticated;
GRANT TRIGGER ON doctors.partner_referral_email_sends TO authenticated;
GRANT INSERT ON doctors.partner_referral_email_sends TO service_role;
GRANT SELECT ON doctors.partner_referral_email_sends TO service_role;
GRANT UPDATE ON doctors.partner_referral_email_sends TO service_role;
GRANT DELETE ON doctors.partner_referral_email_sends TO service_role;
GRANT TRUNCATE ON doctors.partner_referral_email_sends TO service_role;
GRANT REFERENCES ON doctors.partner_referral_email_sends TO service_role;
GRANT TRIGGER ON doctors.partner_referral_email_sends TO service_role;
GRANT INSERT ON doctors.registration_email_settings TO anon;
GRANT SELECT ON doctors.registration_email_settings TO anon;
GRANT UPDATE ON doctors.registration_email_settings TO anon;
GRANT DELETE ON doctors.registration_email_settings TO anon;
GRANT TRUNCATE ON doctors.registration_email_settings TO anon;
GRANT REFERENCES ON doctors.registration_email_settings TO anon;
GRANT TRIGGER ON doctors.registration_email_settings TO anon;
GRANT INSERT ON doctors.registration_email_settings TO authenticated;
GRANT SELECT ON doctors.registration_email_settings TO authenticated;
GRANT UPDATE ON doctors.registration_email_settings TO authenticated;
GRANT DELETE ON doctors.registration_email_settings TO authenticated;
GRANT TRUNCATE ON doctors.registration_email_settings TO authenticated;
GRANT REFERENCES ON doctors.registration_email_settings TO authenticated;
GRANT TRIGGER ON doctors.registration_email_settings TO authenticated;
GRANT INSERT ON doctors.registration_email_settings TO service_role;
GRANT SELECT ON doctors.registration_email_settings TO service_role;
GRANT UPDATE ON doctors.registration_email_settings TO service_role;
GRANT DELETE ON doctors.registration_email_settings TO service_role;
GRANT TRUNCATE ON doctors.registration_email_settings TO service_role;
GRANT REFERENCES ON doctors.registration_email_settings TO service_role;
GRANT TRIGGER ON doctors.registration_email_settings TO service_role;
GRANT INSERT ON doctors.registration_email_sends TO anon;
GRANT SELECT ON doctors.registration_email_sends TO anon;
GRANT UPDATE ON doctors.registration_email_sends TO anon;
GRANT DELETE ON doctors.registration_email_sends TO anon;
GRANT TRUNCATE ON doctors.registration_email_sends TO anon;
GRANT REFERENCES ON doctors.registration_email_sends TO anon;
GRANT TRIGGER ON doctors.registration_email_sends TO anon;
GRANT INSERT ON doctors.registration_email_sends TO authenticated;
GRANT SELECT ON doctors.registration_email_sends TO authenticated;
GRANT UPDATE ON doctors.registration_email_sends TO authenticated;
GRANT DELETE ON doctors.registration_email_sends TO authenticated;
GRANT TRUNCATE ON doctors.registration_email_sends TO authenticated;
GRANT REFERENCES ON doctors.registration_email_sends TO authenticated;
GRANT TRIGGER ON doctors.registration_email_sends TO authenticated;
GRANT INSERT ON doctors.registration_email_sends TO service_role;
GRANT SELECT ON doctors.registration_email_sends TO service_role;
GRANT UPDATE ON doctors.registration_email_sends TO service_role;
GRANT DELETE ON doctors.registration_email_sends TO service_role;
GRANT TRUNCATE ON doctors.registration_email_sends TO service_role;
GRANT REFERENCES ON doctors.registration_email_sends TO service_role;
GRANT TRIGGER ON doctors.registration_email_sends TO service_role;
GRANT INSERT ON doctors.shop_orders TO anon;
GRANT SELECT ON doctors.shop_orders TO anon;
GRANT UPDATE ON doctors.shop_orders TO anon;
GRANT DELETE ON doctors.shop_orders TO anon;
GRANT TRUNCATE ON doctors.shop_orders TO anon;
GRANT REFERENCES ON doctors.shop_orders TO anon;
GRANT TRIGGER ON doctors.shop_orders TO anon;
GRANT INSERT ON doctors.shop_orders TO authenticated;
GRANT SELECT ON doctors.shop_orders TO authenticated;
GRANT UPDATE ON doctors.shop_orders TO authenticated;
GRANT DELETE ON doctors.shop_orders TO authenticated;
GRANT TRUNCATE ON doctors.shop_orders TO authenticated;
GRANT REFERENCES ON doctors.shop_orders TO authenticated;
GRANT TRIGGER ON doctors.shop_orders TO authenticated;
GRANT INSERT ON doctors.shop_orders TO service_role;
GRANT SELECT ON doctors.shop_orders TO service_role;
GRANT UPDATE ON doctors.shop_orders TO service_role;
GRANT DELETE ON doctors.shop_orders TO service_role;
GRANT TRUNCATE ON doctors.shop_orders TO service_role;
GRANT REFERENCES ON doctors.shop_orders TO service_role;
GRANT TRIGGER ON doctors.shop_orders TO service_role;
GRANT INSERT ON doctors.shop_order_email_sends TO anon;
GRANT SELECT ON doctors.shop_order_email_sends TO anon;
GRANT UPDATE ON doctors.shop_order_email_sends TO anon;
GRANT DELETE ON doctors.shop_order_email_sends TO anon;
GRANT TRUNCATE ON doctors.shop_order_email_sends TO anon;
GRANT REFERENCES ON doctors.shop_order_email_sends TO anon;
GRANT TRIGGER ON doctors.shop_order_email_sends TO anon;
GRANT INSERT ON doctors.shop_order_email_sends TO authenticated;
GRANT SELECT ON doctors.shop_order_email_sends TO authenticated;
GRANT UPDATE ON doctors.shop_order_email_sends TO authenticated;
GRANT DELETE ON doctors.shop_order_email_sends TO authenticated;
GRANT TRUNCATE ON doctors.shop_order_email_sends TO authenticated;
GRANT REFERENCES ON doctors.shop_order_email_sends TO authenticated;
GRANT TRIGGER ON doctors.shop_order_email_sends TO authenticated;
GRANT INSERT ON doctors.shop_order_email_sends TO service_role;
GRANT SELECT ON doctors.shop_order_email_sends TO service_role;
GRANT UPDATE ON doctors.shop_order_email_sends TO service_role;
GRANT DELETE ON doctors.shop_order_email_sends TO service_role;
GRANT TRUNCATE ON doctors.shop_order_email_sends TO service_role;
GRANT REFERENCES ON doctors.shop_order_email_sends TO service_role;
GRANT TRIGGER ON doctors.shop_order_email_sends TO service_role;
GRANT INSERT ON doctors.sms_campaigns TO anon;
GRANT SELECT ON doctors.sms_campaigns TO anon;
GRANT UPDATE ON doctors.sms_campaigns TO anon;
GRANT DELETE ON doctors.sms_campaigns TO anon;
GRANT TRUNCATE ON doctors.sms_campaigns TO anon;
GRANT REFERENCES ON doctors.sms_campaigns TO anon;
GRANT TRIGGER ON doctors.sms_campaigns TO anon;
GRANT INSERT ON doctors.sms_campaigns TO authenticated;
GRANT SELECT ON doctors.sms_campaigns TO authenticated;
GRANT UPDATE ON doctors.sms_campaigns TO authenticated;
GRANT DELETE ON doctors.sms_campaigns TO authenticated;
GRANT TRUNCATE ON doctors.sms_campaigns TO authenticated;
GRANT REFERENCES ON doctors.sms_campaigns TO authenticated;
GRANT TRIGGER ON doctors.sms_campaigns TO authenticated;
GRANT INSERT ON doctors.sms_campaigns TO service_role;
GRANT SELECT ON doctors.sms_campaigns TO service_role;
GRANT UPDATE ON doctors.sms_campaigns TO service_role;
GRANT DELETE ON doctors.sms_campaigns TO service_role;
GRANT TRUNCATE ON doctors.sms_campaigns TO service_role;
GRANT REFERENCES ON doctors.sms_campaigns TO service_role;
GRANT TRIGGER ON doctors.sms_campaigns TO service_role;
GRANT INSERT ON doctors.sms_sends TO anon;
GRANT SELECT ON doctors.sms_sends TO anon;
GRANT UPDATE ON doctors.sms_sends TO anon;
GRANT DELETE ON doctors.sms_sends TO anon;
GRANT TRUNCATE ON doctors.sms_sends TO anon;
GRANT REFERENCES ON doctors.sms_sends TO anon;
GRANT TRIGGER ON doctors.sms_sends TO anon;
GRANT INSERT ON doctors.sms_sends TO authenticated;
GRANT SELECT ON doctors.sms_sends TO authenticated;
GRANT UPDATE ON doctors.sms_sends TO authenticated;
GRANT DELETE ON doctors.sms_sends TO authenticated;
GRANT TRUNCATE ON doctors.sms_sends TO authenticated;
GRANT REFERENCES ON doctors.sms_sends TO authenticated;
GRANT TRIGGER ON doctors.sms_sends TO authenticated;
GRANT INSERT ON doctors.sms_sends TO service_role;
GRANT SELECT ON doctors.sms_sends TO service_role;
GRANT UPDATE ON doctors.sms_sends TO service_role;
GRANT DELETE ON doctors.sms_sends TO service_role;
GRANT TRUNCATE ON doctors.sms_sends TO service_role;
GRANT REFERENCES ON doctors.sms_sends TO service_role;
GRANT TRIGGER ON doctors.sms_sends TO service_role;
GRANT INSERT ON doctors.wheel_admin_settings TO anon;
GRANT SELECT ON doctors.wheel_admin_settings TO anon;
GRANT UPDATE ON doctors.wheel_admin_settings TO anon;
GRANT DELETE ON doctors.wheel_admin_settings TO anon;
GRANT TRUNCATE ON doctors.wheel_admin_settings TO anon;
GRANT REFERENCES ON doctors.wheel_admin_settings TO anon;
GRANT TRIGGER ON doctors.wheel_admin_settings TO anon;
GRANT INSERT ON doctors.wheel_admin_settings TO authenticated;
GRANT SELECT ON doctors.wheel_admin_settings TO authenticated;
GRANT UPDATE ON doctors.wheel_admin_settings TO authenticated;
GRANT DELETE ON doctors.wheel_admin_settings TO authenticated;
GRANT TRUNCATE ON doctors.wheel_admin_settings TO authenticated;
GRANT REFERENCES ON doctors.wheel_admin_settings TO authenticated;
GRANT TRIGGER ON doctors.wheel_admin_settings TO authenticated;
GRANT INSERT ON doctors.wheel_admin_settings TO service_role;
GRANT SELECT ON doctors.wheel_admin_settings TO service_role;
GRANT UPDATE ON doctors.wheel_admin_settings TO service_role;
GRANT DELETE ON doctors.wheel_admin_settings TO service_role;
GRANT TRUNCATE ON doctors.wheel_admin_settings TO service_role;
GRANT REFERENCES ON doctors.wheel_admin_settings TO service_role;
GRANT TRIGGER ON doctors.wheel_admin_settings TO service_role;
GRANT INSERT ON doctors.wheel_prizes TO anon;
GRANT SELECT ON doctors.wheel_prizes TO anon;
GRANT UPDATE ON doctors.wheel_prizes TO anon;
GRANT DELETE ON doctors.wheel_prizes TO anon;
GRANT TRUNCATE ON doctors.wheel_prizes TO anon;
GRANT REFERENCES ON doctors.wheel_prizes TO anon;
GRANT TRIGGER ON doctors.wheel_prizes TO anon;
GRANT INSERT ON doctors.wheel_prizes TO authenticated;
GRANT SELECT ON doctors.wheel_prizes TO authenticated;
GRANT UPDATE ON doctors.wheel_prizes TO authenticated;
GRANT DELETE ON doctors.wheel_prizes TO authenticated;
GRANT TRUNCATE ON doctors.wheel_prizes TO authenticated;
GRANT REFERENCES ON doctors.wheel_prizes TO authenticated;
GRANT TRIGGER ON doctors.wheel_prizes TO authenticated;
GRANT INSERT ON doctors.wheel_prizes TO service_role;
GRANT SELECT ON doctors.wheel_prizes TO service_role;
GRANT UPDATE ON doctors.wheel_prizes TO service_role;
GRANT DELETE ON doctors.wheel_prizes TO service_role;
GRANT TRUNCATE ON doctors.wheel_prizes TO service_role;
GRANT REFERENCES ON doctors.wheel_prizes TO service_role;
GRANT TRIGGER ON doctors.wheel_prizes TO service_role;
GRANT INSERT ON doctors.newsletter_sends TO anon;
GRANT SELECT ON doctors.newsletter_sends TO anon;
GRANT UPDATE ON doctors.newsletter_sends TO anon;
GRANT DELETE ON doctors.newsletter_sends TO anon;
GRANT TRUNCATE ON doctors.newsletter_sends TO anon;
GRANT REFERENCES ON doctors.newsletter_sends TO anon;
GRANT TRIGGER ON doctors.newsletter_sends TO anon;
GRANT INSERT ON doctors.newsletter_sends TO authenticated;
GRANT SELECT ON doctors.newsletter_sends TO authenticated;
GRANT UPDATE ON doctors.newsletter_sends TO authenticated;
GRANT DELETE ON doctors.newsletter_sends TO authenticated;
GRANT TRUNCATE ON doctors.newsletter_sends TO authenticated;
GRANT REFERENCES ON doctors.newsletter_sends TO authenticated;
GRANT TRIGGER ON doctors.newsletter_sends TO authenticated;
GRANT INSERT ON doctors.newsletter_sends TO service_role;
GRANT SELECT ON doctors.newsletter_sends TO service_role;
GRANT UPDATE ON doctors.newsletter_sends TO service_role;
GRANT DELETE ON doctors.newsletter_sends TO service_role;
GRANT TRUNCATE ON doctors.newsletter_sends TO service_role;
GRANT REFERENCES ON doctors.newsletter_sends TO service_role;
GRANT TRIGGER ON doctors.newsletter_sends TO service_role;
GRANT INSERT ON doctors.email_sequence_steps TO anon;
GRANT SELECT ON doctors.email_sequence_steps TO anon;
GRANT UPDATE ON doctors.email_sequence_steps TO anon;
GRANT DELETE ON doctors.email_sequence_steps TO anon;
GRANT TRUNCATE ON doctors.email_sequence_steps TO anon;
GRANT REFERENCES ON doctors.email_sequence_steps TO anon;
GRANT TRIGGER ON doctors.email_sequence_steps TO anon;
GRANT INSERT ON doctors.email_sequence_steps TO authenticated;
GRANT SELECT ON doctors.email_sequence_steps TO authenticated;
GRANT UPDATE ON doctors.email_sequence_steps TO authenticated;
GRANT DELETE ON doctors.email_sequence_steps TO authenticated;
GRANT TRUNCATE ON doctors.email_sequence_steps TO authenticated;
GRANT REFERENCES ON doctors.email_sequence_steps TO authenticated;
GRANT TRIGGER ON doctors.email_sequence_steps TO authenticated;
GRANT INSERT ON doctors.email_sequence_steps TO service_role;
GRANT SELECT ON doctors.email_sequence_steps TO service_role;
GRANT UPDATE ON doctors.email_sequence_steps TO service_role;
GRANT DELETE ON doctors.email_sequence_steps TO service_role;
GRANT TRUNCATE ON doctors.email_sequence_steps TO service_role;
GRANT REFERENCES ON doctors.email_sequence_steps TO service_role;
GRANT TRIGGER ON doctors.email_sequence_steps TO service_role;
GRANT INSERT ON doctors.email_sequence_sends TO anon;
GRANT SELECT ON doctors.email_sequence_sends TO anon;
GRANT UPDATE ON doctors.email_sequence_sends TO anon;
GRANT DELETE ON doctors.email_sequence_sends TO anon;
GRANT TRUNCATE ON doctors.email_sequence_sends TO anon;
GRANT REFERENCES ON doctors.email_sequence_sends TO anon;
GRANT TRIGGER ON doctors.email_sequence_sends TO anon;
GRANT INSERT ON doctors.email_sequence_sends TO authenticated;
GRANT SELECT ON doctors.email_sequence_sends TO authenticated;
GRANT UPDATE ON doctors.email_sequence_sends TO authenticated;
GRANT DELETE ON doctors.email_sequence_sends TO authenticated;
GRANT TRUNCATE ON doctors.email_sequence_sends TO authenticated;
GRANT REFERENCES ON doctors.email_sequence_sends TO authenticated;
GRANT TRIGGER ON doctors.email_sequence_sends TO authenticated;
GRANT INSERT ON doctors.email_sequence_sends TO service_role;
GRANT SELECT ON doctors.email_sequence_sends TO service_role;
GRANT UPDATE ON doctors.email_sequence_sends TO service_role;
GRANT DELETE ON doctors.email_sequence_sends TO service_role;
GRANT TRUNCATE ON doctors.email_sequence_sends TO service_role;
GRANT REFERENCES ON doctors.email_sequence_sends TO service_role;
GRANT TRIGGER ON doctors.email_sequence_sends TO service_role;
GRANT INSERT ON doctors.partner_referral_email_settings TO anon;
GRANT SELECT ON doctors.partner_referral_email_settings TO anon;
GRANT UPDATE ON doctors.partner_referral_email_settings TO anon;
GRANT DELETE ON doctors.partner_referral_email_settings TO anon;
GRANT TRUNCATE ON doctors.partner_referral_email_settings TO anon;
GRANT REFERENCES ON doctors.partner_referral_email_settings TO anon;
GRANT TRIGGER ON doctors.partner_referral_email_settings TO anon;
GRANT INSERT ON doctors.partner_referral_email_settings TO authenticated;
GRANT SELECT ON doctors.partner_referral_email_settings TO authenticated;
GRANT UPDATE ON doctors.partner_referral_email_settings TO authenticated;
GRANT DELETE ON doctors.partner_referral_email_settings TO authenticated;
GRANT TRUNCATE ON doctors.partner_referral_email_settings TO authenticated;
GRANT REFERENCES ON doctors.partner_referral_email_settings TO authenticated;
GRANT TRIGGER ON doctors.partner_referral_email_settings TO authenticated;
GRANT INSERT ON doctors.partner_referral_email_settings TO service_role;
GRANT SELECT ON doctors.partner_referral_email_settings TO service_role;
GRANT UPDATE ON doctors.partner_referral_email_settings TO service_role;
GRANT DELETE ON doctors.partner_referral_email_settings TO service_role;
GRANT TRUNCATE ON doctors.partner_referral_email_settings TO service_role;
GRANT REFERENCES ON doctors.partner_referral_email_settings TO service_role;
GRANT TRIGGER ON doctors.partner_referral_email_settings TO service_role;
GRANT INSERT ON sandbox.shop_order_email_sends TO anon;
GRANT SELECT ON sandbox.shop_order_email_sends TO anon;
GRANT UPDATE ON sandbox.shop_order_email_sends TO anon;
GRANT DELETE ON sandbox.shop_order_email_sends TO anon;
GRANT TRUNCATE ON sandbox.shop_order_email_sends TO anon;
GRANT REFERENCES ON sandbox.shop_order_email_sends TO anon;
GRANT TRIGGER ON sandbox.shop_order_email_sends TO anon;
GRANT INSERT ON sandbox.shop_order_email_sends TO authenticated;
GRANT SELECT ON sandbox.shop_order_email_sends TO authenticated;
GRANT UPDATE ON sandbox.shop_order_email_sends TO authenticated;
GRANT DELETE ON sandbox.shop_order_email_sends TO authenticated;
GRANT TRUNCATE ON sandbox.shop_order_email_sends TO authenticated;
GRANT REFERENCES ON sandbox.shop_order_email_sends TO authenticated;
GRANT TRIGGER ON sandbox.shop_order_email_sends TO authenticated;
GRANT INSERT ON sandbox.shop_order_email_sends TO service_role;
GRANT SELECT ON sandbox.shop_order_email_sends TO service_role;
GRANT UPDATE ON sandbox.shop_order_email_sends TO service_role;
GRANT DELETE ON sandbox.shop_order_email_sends TO service_role;
GRANT TRUNCATE ON sandbox.shop_order_email_sends TO service_role;
GRANT REFERENCES ON sandbox.shop_order_email_sends TO service_role;
GRANT TRIGGER ON sandbox.shop_order_email_sends TO service_role;
GRANT INSERT ON sandbox.referral_clicks TO anon;
GRANT SELECT ON sandbox.referral_clicks TO anon;
GRANT UPDATE ON sandbox.referral_clicks TO anon;
GRANT DELETE ON sandbox.referral_clicks TO anon;
GRANT TRUNCATE ON sandbox.referral_clicks TO anon;
GRANT REFERENCES ON sandbox.referral_clicks TO anon;
GRANT TRIGGER ON sandbox.referral_clicks TO anon;
GRANT INSERT ON sandbox.referral_clicks TO authenticated;
GRANT SELECT ON sandbox.referral_clicks TO authenticated;
GRANT UPDATE ON sandbox.referral_clicks TO authenticated;
GRANT DELETE ON sandbox.referral_clicks TO authenticated;
GRANT TRUNCATE ON sandbox.referral_clicks TO authenticated;
GRANT REFERENCES ON sandbox.referral_clicks TO authenticated;
GRANT TRIGGER ON sandbox.referral_clicks TO authenticated;
GRANT INSERT ON sandbox.referral_clicks TO service_role;
GRANT SELECT ON sandbox.referral_clicks TO service_role;
GRANT UPDATE ON sandbox.referral_clicks TO service_role;
GRANT DELETE ON sandbox.referral_clicks TO service_role;
GRANT TRUNCATE ON sandbox.referral_clicks TO service_role;
GRANT REFERENCES ON sandbox.referral_clicks TO service_role;
GRANT TRIGGER ON sandbox.referral_clicks TO service_role;
GRANT INSERT ON doctors.doctor_registrations TO anon;
GRANT SELECT ON doctors.doctor_registrations TO anon;
GRANT UPDATE ON doctors.doctor_registrations TO anon;
GRANT DELETE ON doctors.doctor_registrations TO anon;
GRANT TRUNCATE ON doctors.doctor_registrations TO anon;
GRANT REFERENCES ON doctors.doctor_registrations TO anon;
GRANT TRIGGER ON doctors.doctor_registrations TO anon;
GRANT INSERT ON doctors.doctor_registrations TO authenticated;
GRANT SELECT ON doctors.doctor_registrations TO authenticated;
GRANT UPDATE ON doctors.doctor_registrations TO authenticated;
GRANT DELETE ON doctors.doctor_registrations TO authenticated;
GRANT TRUNCATE ON doctors.doctor_registrations TO authenticated;
GRANT REFERENCES ON doctors.doctor_registrations TO authenticated;
GRANT TRIGGER ON doctors.doctor_registrations TO authenticated;
GRANT INSERT ON doctors.doctor_registrations TO service_role;
GRANT SELECT ON doctors.doctor_registrations TO service_role;
GRANT UPDATE ON doctors.doctor_registrations TO service_role;
GRANT DELETE ON doctors.doctor_registrations TO service_role;
GRANT TRUNCATE ON doctors.doctor_registrations TO service_role;
GRANT REFERENCES ON doctors.doctor_registrations TO service_role;
GRANT TRIGGER ON doctors.doctor_registrations TO service_role;
GRANT INSERT ON doctors.testimonials TO anon;
GRANT SELECT ON doctors.testimonials TO anon;
GRANT UPDATE ON doctors.testimonials TO anon;
GRANT DELETE ON doctors.testimonials TO anon;
GRANT TRUNCATE ON doctors.testimonials TO anon;
GRANT REFERENCES ON doctors.testimonials TO anon;
GRANT TRIGGER ON doctors.testimonials TO anon;
GRANT INSERT ON doctors.testimonials TO authenticated;
GRANT SELECT ON doctors.testimonials TO authenticated;
GRANT UPDATE ON doctors.testimonials TO authenticated;
GRANT DELETE ON doctors.testimonials TO authenticated;
GRANT TRUNCATE ON doctors.testimonials TO authenticated;
GRANT REFERENCES ON doctors.testimonials TO authenticated;
GRANT TRIGGER ON doctors.testimonials TO authenticated;
GRANT INSERT ON doctors.testimonials TO service_role;
GRANT SELECT ON doctors.testimonials TO service_role;
GRANT UPDATE ON doctors.testimonials TO service_role;
GRANT DELETE ON doctors.testimonials TO service_role;
GRANT TRUNCATE ON doctors.testimonials TO service_role;
GRANT REFERENCES ON doctors.testimonials TO service_role;
GRANT TRIGGER ON doctors.testimonials TO service_role;
GRANT INSERT ON doctors.admin_impersonation_log TO anon;
GRANT SELECT ON doctors.admin_impersonation_log TO anon;
GRANT UPDATE ON doctors.admin_impersonation_log TO anon;
GRANT DELETE ON doctors.admin_impersonation_log TO anon;
GRANT TRUNCATE ON doctors.admin_impersonation_log TO anon;
GRANT REFERENCES ON doctors.admin_impersonation_log TO anon;
GRANT TRIGGER ON doctors.admin_impersonation_log TO anon;
GRANT INSERT ON doctors.admin_impersonation_log TO authenticated;
GRANT SELECT ON doctors.admin_impersonation_log TO authenticated;
GRANT UPDATE ON doctors.admin_impersonation_log TO authenticated;
GRANT DELETE ON doctors.admin_impersonation_log TO authenticated;
GRANT TRUNCATE ON doctors.admin_impersonation_log TO authenticated;
GRANT REFERENCES ON doctors.admin_impersonation_log TO authenticated;
GRANT TRIGGER ON doctors.admin_impersonation_log TO authenticated;
GRANT INSERT ON doctors.admin_impersonation_log TO service_role;
GRANT SELECT ON doctors.admin_impersonation_log TO service_role;
GRANT UPDATE ON doctors.admin_impersonation_log TO service_role;
GRANT DELETE ON doctors.admin_impersonation_log TO service_role;
GRANT TRUNCATE ON doctors.admin_impersonation_log TO service_role;
GRANT REFERENCES ON doctors.admin_impersonation_log TO service_role;
GRANT TRIGGER ON doctors.admin_impersonation_log TO service_role;
GRANT INSERT ON sandbox.partner_points TO anon;
GRANT SELECT ON sandbox.partner_points TO anon;
GRANT UPDATE ON sandbox.partner_points TO anon;
GRANT DELETE ON sandbox.partner_points TO anon;
GRANT TRUNCATE ON sandbox.partner_points TO anon;
GRANT REFERENCES ON sandbox.partner_points TO anon;
GRANT TRIGGER ON sandbox.partner_points TO anon;
GRANT INSERT ON sandbox.partner_points TO authenticated;
GRANT SELECT ON sandbox.partner_points TO authenticated;
GRANT UPDATE ON sandbox.partner_points TO authenticated;
GRANT DELETE ON sandbox.partner_points TO authenticated;
GRANT TRUNCATE ON sandbox.partner_points TO authenticated;
GRANT REFERENCES ON sandbox.partner_points TO authenticated;
GRANT TRIGGER ON sandbox.partner_points TO authenticated;
GRANT INSERT ON sandbox.partner_points TO service_role;
GRANT SELECT ON sandbox.partner_points TO service_role;
GRANT UPDATE ON sandbox.partner_points TO service_role;
GRANT DELETE ON sandbox.partner_points TO service_role;
GRANT TRUNCATE ON sandbox.partner_points TO service_role;
GRANT REFERENCES ON sandbox.partner_points TO service_role;
GRANT TRIGGER ON sandbox.partner_points TO service_role;
GRANT INSERT ON sandbox.milestone_unlocks TO anon;
GRANT SELECT ON sandbox.milestone_unlocks TO anon;
GRANT UPDATE ON sandbox.milestone_unlocks TO anon;
GRANT DELETE ON sandbox.milestone_unlocks TO anon;
GRANT TRUNCATE ON sandbox.milestone_unlocks TO anon;
GRANT REFERENCES ON sandbox.milestone_unlocks TO anon;
GRANT TRIGGER ON sandbox.milestone_unlocks TO anon;
GRANT INSERT ON sandbox.milestone_unlocks TO authenticated;
GRANT SELECT ON sandbox.milestone_unlocks TO authenticated;
GRANT UPDATE ON sandbox.milestone_unlocks TO authenticated;
GRANT DELETE ON sandbox.milestone_unlocks TO authenticated;
GRANT TRUNCATE ON sandbox.milestone_unlocks TO authenticated;
GRANT REFERENCES ON sandbox.milestone_unlocks TO authenticated;
GRANT TRIGGER ON sandbox.milestone_unlocks TO authenticated;
GRANT INSERT ON sandbox.milestone_unlocks TO service_role;
GRANT SELECT ON sandbox.milestone_unlocks TO service_role;
GRANT UPDATE ON sandbox.milestone_unlocks TO service_role;
GRANT DELETE ON sandbox.milestone_unlocks TO service_role;
GRANT TRUNCATE ON sandbox.milestone_unlocks TO service_role;
GRANT REFERENCES ON sandbox.milestone_unlocks TO service_role;
GRANT TRIGGER ON sandbox.milestone_unlocks TO service_role;
GRANT INSERT ON doctors.partner_points TO anon;
GRANT SELECT ON doctors.partner_points TO anon;
GRANT UPDATE ON doctors.partner_points TO anon;
GRANT DELETE ON doctors.partner_points TO anon;
GRANT TRUNCATE ON doctors.partner_points TO anon;
GRANT REFERENCES ON doctors.partner_points TO anon;
GRANT TRIGGER ON doctors.partner_points TO anon;
GRANT INSERT ON doctors.partner_points TO authenticated;
GRANT SELECT ON doctors.partner_points TO authenticated;
GRANT UPDATE ON doctors.partner_points TO authenticated;
GRANT DELETE ON doctors.partner_points TO authenticated;
GRANT TRUNCATE ON doctors.partner_points TO authenticated;
GRANT REFERENCES ON doctors.partner_points TO authenticated;
GRANT TRIGGER ON doctors.partner_points TO authenticated;
GRANT INSERT ON doctors.partner_points TO service_role;
GRANT SELECT ON doctors.partner_points TO service_role;
GRANT UPDATE ON doctors.partner_points TO service_role;
GRANT DELETE ON doctors.partner_points TO service_role;
GRANT TRUNCATE ON doctors.partner_points TO service_role;
GRANT REFERENCES ON doctors.partner_points TO service_role;
GRANT TRIGGER ON doctors.partner_points TO service_role;
GRANT INSERT ON doctors.milestone_unlocks TO anon;
GRANT SELECT ON doctors.milestone_unlocks TO anon;
GRANT UPDATE ON doctors.milestone_unlocks TO anon;
GRANT DELETE ON doctors.milestone_unlocks TO anon;
GRANT TRUNCATE ON doctors.milestone_unlocks TO anon;
GRANT REFERENCES ON doctors.milestone_unlocks TO anon;
GRANT TRIGGER ON doctors.milestone_unlocks TO anon;
GRANT INSERT ON doctors.milestone_unlocks TO authenticated;
GRANT SELECT ON doctors.milestone_unlocks TO authenticated;
GRANT UPDATE ON doctors.milestone_unlocks TO authenticated;
GRANT DELETE ON doctors.milestone_unlocks TO authenticated;
GRANT TRUNCATE ON doctors.milestone_unlocks TO authenticated;
GRANT REFERENCES ON doctors.milestone_unlocks TO authenticated;
GRANT TRIGGER ON doctors.milestone_unlocks TO authenticated;
GRANT INSERT ON doctors.milestone_unlocks TO service_role;
GRANT SELECT ON doctors.milestone_unlocks TO service_role;
GRANT UPDATE ON doctors.milestone_unlocks TO service_role;
GRANT DELETE ON doctors.milestone_unlocks TO service_role;
GRANT TRUNCATE ON doctors.milestone_unlocks TO service_role;
GRANT REFERENCES ON doctors.milestone_unlocks TO service_role;
GRANT TRIGGER ON doctors.milestone_unlocks TO service_role;
GRANT INSERT ON doctors.store_promotions TO anon;
GRANT SELECT ON doctors.store_promotions TO anon;
GRANT UPDATE ON doctors.store_promotions TO anon;
GRANT DELETE ON doctors.store_promotions TO anon;
GRANT TRUNCATE ON doctors.store_promotions TO anon;
GRANT REFERENCES ON doctors.store_promotions TO anon;
GRANT TRIGGER ON doctors.store_promotions TO anon;
GRANT INSERT ON doctors.store_promotions TO authenticated;
GRANT SELECT ON doctors.store_promotions TO authenticated;
GRANT UPDATE ON doctors.store_promotions TO authenticated;
GRANT DELETE ON doctors.store_promotions TO authenticated;
GRANT TRUNCATE ON doctors.store_promotions TO authenticated;
GRANT REFERENCES ON doctors.store_promotions TO authenticated;
GRANT TRIGGER ON doctors.store_promotions TO authenticated;
GRANT INSERT ON doctors.store_promotions TO service_role;
GRANT SELECT ON doctors.store_promotions TO service_role;
GRANT UPDATE ON doctors.store_promotions TO service_role;
GRANT DELETE ON doctors.store_promotions TO service_role;
GRANT TRUNCATE ON doctors.store_promotions TO service_role;
GRANT REFERENCES ON doctors.store_promotions TO service_role;
GRANT TRIGGER ON doctors.store_promotions TO service_role;
GRANT INSERT ON sandbox.store_promotions TO anon;
GRANT SELECT ON sandbox.store_promotions TO anon;
GRANT UPDATE ON sandbox.store_promotions TO anon;
GRANT DELETE ON sandbox.store_promotions TO anon;
GRANT TRUNCATE ON sandbox.store_promotions TO anon;
GRANT REFERENCES ON sandbox.store_promotions TO anon;
GRANT TRIGGER ON sandbox.store_promotions TO anon;
GRANT INSERT ON sandbox.store_promotions TO authenticated;
GRANT SELECT ON sandbox.store_promotions TO authenticated;
GRANT UPDATE ON sandbox.store_promotions TO authenticated;
GRANT DELETE ON sandbox.store_promotions TO authenticated;
GRANT TRUNCATE ON sandbox.store_promotions TO authenticated;
GRANT REFERENCES ON sandbox.store_promotions TO authenticated;
GRANT TRIGGER ON sandbox.store_promotions TO authenticated;
GRANT INSERT ON sandbox.store_promotions TO service_role;
GRANT SELECT ON sandbox.store_promotions TO service_role;
GRANT UPDATE ON sandbox.store_promotions TO service_role;
GRANT DELETE ON sandbox.store_promotions TO service_role;
GRANT TRUNCATE ON sandbox.store_promotions TO service_role;
GRANT REFERENCES ON sandbox.store_promotions TO service_role;
GRANT TRIGGER ON sandbox.store_promotions TO service_role;
set check_function_bodies = off;
-- FUNCTIONS
CREATE OR REPLACE FUNCTION doctors.admin_get_shop_order(p_admin_password text, p_order_id uuid)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query select * from doctors.admin_get_shop_order_unchecked(p_order_id);
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_get_shop_order(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_get_shop_order(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_get_shop_order_unchecked(p_order_id uuid)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select * from doctors.shop_orders where id = p_order_id limit 1;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_get_shop_order_unchecked(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_get_shop_order_unchecked(uuid) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_list_doctor_registrations(p_admin_password text)
 RETURNS TABLE(id uuid, full_name text, name_prefix text, email text, mobile text, tiktok_username text, routing_slug text, redirect_url text, specialty text, practice_location text, created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    doctor_registrations.id,
    doctor_registrations.full_name::text,
    doctor_registrations.name_prefix::text,
    doctor_registrations.email::text,
    doctor_registrations.mobile::text,
    doctor_registrations.tiktok_username::text,
    doctor_registrations.routing_slug::text,
    coalesce(doctor_registrations.redirect_url, '')::text,
    doctor_registrations.specialty::text,
    doctor_registrations.practice_location::text,
    doctor_registrations.created_at,
    null::text as prize_label,
    null::timestamptz as prize_claimed_at
  from doctors.doctor_registrations
  order by doctor_registrations.created_at desc;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_list_doctor_registrations(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_list_doctor_registrations(text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_list_newsletter_sends(p_admin_password text)
 RETURNS TABLE(id uuid, doctor_id uuid, newsletter_id uuid, newsletter_title text, email text, subject text, status text, resend_id text, error_message text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    ns.id,
    ns.doctor_id,
    ns.newsletter_id,
    nc.title as newsletter_title,
    ns.email,
    ns.subject,
    ns.status,
    ns.resend_id,
    ns.error_message,
    ns.sent_at
  from doctors.newsletter_sends ns
  left join doctors.newsletter_campaigns nc on nc.id = ns.newsletter_id
  order by ns.sent_at desc;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_list_newsletter_sends(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_list_newsletter_sends(text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_list_shop_orders(p_admin_password text)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select * from doctors.shop_orders order by created_at desc;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_list_shop_orders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_list_shop_orders(text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_list_sms_sends(p_admin_password text)
 RETURNS TABLE(id uuid, doctor_id uuid, sms_campaign_id uuid, sms_campaign_title text, mobile text, message text, status text, provider_message_id text, error_message text, sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    sms_sends.id,
    sms_sends.doctor_id,
    sms_sends.sms_campaign_id,
    sms_campaigns.title,
    sms_sends.mobile,
    sms_sends.message,
    sms_sends.status,
    sms_sends.provider_message_id,
    sms_sends.error_message,
    sms_sends.sent_at
  from doctors.sms_sends
  left join doctors.sms_campaigns on sms_campaigns.id = sms_sends.sms_campaign_id
  order by sms_sends.sent_at desc;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_list_sms_sends(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_list_sms_sends(text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_list_testimonials(p_admin_password text, p_status text DEFAULT NULL::text)
 RETURNS SETOF doctors.testimonials
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select *
  from doctors.testimonials t
  where p_status is null or t.status = p_status
  order by
    case t.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    t.created_at desc;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_list_testimonials(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_list_testimonials(text,text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_list_wheel_prizes(p_admin_password text)
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select
    p.id, p.label, p.note, p.color, p.text_color,
    p.chance_weight, p.total_stock, p.remaining_stock,
    p.is_active, p.sort_order,
    coalesce(c.claim_count, 0) as claim_count
  from doctors.wheel_prizes p
  left join (
    select prize_id, count(*) as claim_count
    from doctors.wheel_claims
    group by prize_id
  ) c on c.prize_id = p.id
  order by p.sort_order, p.created_at;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_list_wheel_prizes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_list_wheel_prizes(text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_promote_partner(p_admin_password text, p_partner_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
DECLARE
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_partner
  FROM doctors.doctor_registrations WHERE id = p_partner_id;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_partner.store_type != 'affiliate' THEN
    RAISE EXCEPTION 'Can only promote affiliate accounts to lifestyle.' USING ERRCODE = '22023';
  END IF;

  UPDATE doctors.doctor_registrations
  SET store_type = 'lifestyle',
      referral_qr_enabled = true,
      promoted_at = now(),
      promoted_by = 'admin'
  WHERE id = p_partner_id;

  INSERT INTO doctors.store_promotions (
    partner_id, from_type, to_type, trigger_type, trigger_admin_note
  ) VALUES (
    p_partner_id, 'affiliate', 'lifestyle', 'admin_manual', p_note
  );

  RETURN jsonb_build_object('success', true, 'partner_id', p_partner_id, 'store_type', 'lifestyle');
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_promote_partner(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_promote_partner(text,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_review_testimonial(p_admin_password text, p_id uuid, p_status text, p_featured boolean DEFAULT false, p_review_note text DEFAULT ''::text)
 RETURNS doctors.testimonials
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_row doctors.testimonials;
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Unknown status %', p_status;
  end if;

  -- Exactly one featured story at a time: the page gives it a layout no second row can
  -- share, so clearing the others here is simpler than picking a winner at render time.
  if p_featured and p_status = 'approved' then
    update doctors.testimonials set featured = false where featured and id <> p_id;
  end if;

  update doctors.testimonials
  set status = p_status,
      featured = (p_featured and p_status = 'approved'),
      review_note = coalesce(p_review_note, ''),
      reviewed_at = now()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Testimonial % not found', p_id;
  end if;

  return v_row;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_review_testimonial(text,uuid,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_review_testimonial(text,uuid,text,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_toggle_referral_qr(p_admin_password text, p_partner_id uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
DECLARE
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_partner
  FROM doctors.doctor_registrations WHERE id = p_partner_id;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE doctors.doctor_registrations
  SET referral_qr_enabled = p_enabled
  WHERE id = p_partner_id;

  INSERT INTO doctors.store_promotions (
    partner_id, from_type, to_type, trigger_type, trigger_admin_note
  ) VALUES (
    p_partner_id, v_partner.store_type, v_partner.store_type, 'admin_qr_toggle',
    CASE WHEN p_enabled THEN 'Referral QR enabled by admin' ELSE 'Referral QR disabled by admin' END
  );

  RETURN jsonb_build_object('success', true, 'partner_id', p_partner_id, 'referral_qr_enabled', p_enabled);
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_toggle_referral_qr(text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_toggle_referral_qr(text,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_update_doctor_registration(p_admin_password text, p_doctor_id uuid, p_full_name text, p_email text, p_mobile text, p_tiktok_username text, p_specialty text, p_practice_location text, p_redirect_url text DEFAULT NULL::text, p_name_prefix text DEFAULT ''::text)
 RETURNS TABLE(id uuid, full_name text, name_prefix text, email text, mobile text, tiktok_username text, routing_slug text, redirect_url text, specialty text, practice_location text, created_at timestamp with time zone, prize_label text, prize_claimed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.doctor_registrations
  set
    name_prefix = trim(coalesce(p_name_prefix, '')),
    full_name = trim(p_full_name),
    email = nullif(lower(trim(coalesce(p_email, ''))), ''),
    mobile = trim(p_mobile),
    tiktok_username = regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', ''),
    redirect_url = nullif(trim(coalesce(p_redirect_url, '')), ''),
    specialty = trim(p_specialty),
    practice_location = trim(p_practice_location)
  where doctor_registrations.id = p_doctor_id;

  return query
  select *
  from doctors.admin_list_doctor_registrations(p_admin_password) registrations
  where registrations.id = p_doctor_id;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_update_doctor_registration(text,uuid,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_update_doctor_registration(text,uuid,text,text,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_update_shop_order(p_admin_password text, p_order_id uuid, p_status text, p_payment_status text, p_maya_reference text DEFAULT NULL::text, p_admin_notes text DEFAULT NULL::text)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update doctors.shop_orders
  set
    status = p_status,
    payment_status = p_payment_status,
    maya_reference = nullif(trim(coalesce(p_maya_reference, '')), ''),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    paid_at = case when p_payment_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where shop_orders.id = p_order_id;

  return query select * from doctors.admin_get_shop_order_unchecked(p_order_id);
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_update_shop_order(text,uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_update_shop_order(text,uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_upgrade_to_main_store(p_admin_password text, p_partner_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
DECLARE
  v_partner doctors.doctor_registrations%ROWTYPE;
  v_old_main_store_id UUID;
  v_descendants_moved INTEGER := 0;
BEGIN
  PERFORM doctors.assert_wheel_admin(p_admin_password);

  SELECT * INTO v_partner
  FROM doctors.doctor_registrations
  WHERE id = p_partner_id;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_partner.store_type != 'lifestyle' THEN
    RAISE EXCEPTION 'Can only upgrade a Lifestyle Store to Main Store. Current type is %', v_partner.store_type USING ERRCODE = '22023';
  END IF;

  v_old_main_store_id := v_partner.main_store_id;

  -- 1. Upgrade partner to Main Store & sever upline referral link
  UPDATE doctors.doctor_registrations
  SET store_type = 'main',
      main_store_id = NULL,
      referred_by_partner_id = NULL,
      referral_qr_enabled = true,
      promoted_at = now(),
      promoted_by = 'admin'
  WHERE id = p_partner_id;

  -- 2. Breakaway: Re-parent all recursive descendants to this new Main Store
  WITH RECURSIVE descendant_tree AS (
    SELECT id FROM doctors.doctor_registrations
    WHERE referred_by_partner_id = p_partner_id

    UNION ALL

    SELECT dr.id
    FROM doctors.doctor_registrations dr
    INNER JOIN descendant_tree dt ON dr.referred_by_partner_id = dt.id
  )
  UPDATE doctors.doctor_registrations
  SET main_store_id = p_partner_id
  WHERE id IN (SELECT id FROM descendant_tree);

  GET DIAGNOSTICS v_descendants_moved = ROW_COUNT;

  -- 3. Audit log
  INSERT INTO doctors.store_promotions (
    partner_id, from_type, to_type, trigger_type, trigger_admin_note
  ) VALUES (
    p_partner_id, 'lifestyle', 'main', 'admin_upgrade_main',
    COALESCE(p_note, '') || ' | Broke away from main_store_id=' || COALESCE(v_old_main_store_id::text, 'NULL')
    || ' | Transferred ' || v_descendants_moved || ' descendant stores'
  );

  RETURN jsonb_build_object(
    'success', true,
    'partner_id', p_partner_id,
    'old_main_store_id', v_old_main_store_id,
    'descendants_moved', v_descendants_moved
  );
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_upgrade_to_main_store(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_upgrade_to_main_store(text,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.admin_upsert_wheel_prize(p_admin_password text, p_id uuid, p_label text, p_note text, p_color text, p_text_color text, p_chance_weight integer, p_total_stock integer, p_remaining_stock integer, p_is_active boolean, p_sort_order integer)
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_id uuid;
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  if p_id is null then
    insert into doctors.wheel_prizes
      (label, note, color, text_color, chance_weight, total_stock, remaining_stock, is_active, sort_order)
    values
      (p_label, p_note, p_color, p_text_color, p_chance_weight, p_total_stock, p_remaining_stock, p_is_active, p_sort_order)
    returning wheel_prizes.id into v_id;
  else
    update doctors.wheel_prizes
    set label = p_label,
        note = p_note,
        color = p_color,
        text_color = p_text_color,
        chance_weight = p_chance_weight,
        total_stock = p_total_stock,
        remaining_stock = p_remaining_stock,
        is_active = p_is_active,
        sort_order = p_sort_order,
        updated_at = now()
    where wheel_prizes.id = p_id
    returning wheel_prizes.id into v_id;
  end if;

  return query
  select *
  from doctors.admin_list_wheel_prizes(p_admin_password) p
  where p.id = v_id;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.admin_upsert_wheel_prize(text,uuid,text,text,text,text,integer,integer,integer,boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.admin_upsert_wheel_prize(text,uuid,text,text,text,text,integer,integer,integer,boolean,integer) TO service_role;

CREATE OR REPLACE FUNCTION doctors.assert_wheel_admin(p_admin_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if not exists (
    select 1
    from doctors.wheel_admin_settings
    where id = true
      and admin_password = p_admin_password
  ) then
    raise exception 'Invalid admin password' using errcode = '28000';
  end if;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.assert_wheel_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.assert_wheel_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.assert_wheel_admin(text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.assert_wheel_admin(text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.award_order_points()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_points INTEGER;
  v_grandparent_id UUID;
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  -- 1. Calculate points (1 point per ₱1000 spent, min 1)
  v_points := FLOOR(COALESCE(NEW.total_amount, 0) / 1000);
  IF v_points < 1 THEN
    v_points := 1;
  END IF;

  IF NEW.referral_doctor_id IS NOT NULL THEN
    -- Fetch referral partner
    SELECT * INTO v_partner
    FROM doctors.doctor_registrations
    WHERE id = NEW.referral_doctor_id;

    IF v_partner.id IS NOT NULL THEN
      -- 2. Award Direct Points (Depth 0)
      INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_partner.id, v_points, 0)
      ON CONFLICT (order_id, partner_id) DO NOTHING;

      -- 3. Award Pass-Up Points to Upline (Depth 1)
      IF v_partner.referred_by_partner_id IS NOT NULL THEN
        INSERT INTO doctors.partner_points (order_id, partner_id, points, depth)
        VALUES (NEW.id, v_partner.referred_by_partner_id, v_points, 1)
        ON CONFLICT (order_id, partner_id) DO NOTHING;
      END IF;

      -- 4. Auto-Promote Affiliate to Lifestyle on First Paid Sale
      IF v_partner.store_type = 'affiliate' THEN
        UPDATE doctors.doctor_registrations
        SET store_type = 'lifestyle',
            referral_qr_enabled = true,
            promoted_at = now(),
            promoted_by = 'auto'
        WHERE id = v_partner.id;

        INSERT INTO doctors.store_promotions (
          partner_id, from_type, to_type, trigger_type, trigger_order_id
        ) VALUES (
          v_partner.id, 'affiliate', 'lifestyle', 'first_sale', NEW.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.award_order_points() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.award_order_points() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.award_order_points() TO anon;
GRANT EXECUTE ON FUNCTION doctors.award_order_points() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.award_order_points() TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.calculate_order_points(p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_points integer := 0;
  v_item jsonb;
BEGIN
  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_points := v_points + (COALESCE((v_item->>'caps')::integer, 0) * COALESCE((v_item->>'qty')::integer, 1)) / 10;
    END LOOP;
  END IF;
  RETURN v_points;
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.calculate_order_points(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.calculate_order_points(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.calculate_order_points(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION doctors.calculate_order_points(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.calculate_order_points(jsonb) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.calculate_order_points(p_items jsonb, p_total_amount numeric DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_points integer := 0;
  v_item jsonb;
  v_caps integer;
BEGIN
  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_caps := COALESCE((v_item->>'caps')::integer, 0);
      IF v_caps > 0 THEN
        v_points := v_points + (v_caps * COALESCE((v_item->>'qty')::integer, COALESCE((v_item->>'quantity')::integer, 1))) / 10;
      END IF;
    END LOOP;
  END IF;
  IF v_points = 0 AND p_total_amount > 0 THEN
    v_points := CASE
      WHEN p_total_amount >= 29000 THEN 33
      WHEN p_total_amount >= 10000 THEN 9
      WHEN p_total_amount >= 3000  THEN 3
      ELSE 1
    END;
  END IF;
  RETURN v_points;
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.calculate_order_points(jsonb,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.calculate_order_points(jsonb,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.calculate_order_points(jsonb,numeric) TO anon;
GRANT EXECUTE ON FUNCTION doctors.calculate_order_points(jsonb,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.calculate_order_points(jsonb,numeric) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.claim_prize(p_doctor_id uuid)
 RETURNS TABLE(prize_id uuid, prize_label text, prize_note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_total_weight integer;
  v_target double precision;
  v_running double precision := 0;
  v_prize doctors.wheel_prizes%rowtype;
begin
  if not exists (select 1 from doctors.doctor_registrations d where d.id = p_doctor_id) then
    raise exception 'Unknown registration.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_doctor_id::text));

  return query
  select c.prize_id, c.prize_label_snapshot, c.prize_note_snapshot, p.color, p.text_color,
         p.chance_weight, p.total_stock, p.remaining_stock, p.is_active, p.sort_order
  from doctors.wheel_claims c
  join doctors.wheel_prizes p on p.id = c.prize_id
  where c.doctor_id = p_doctor_id;

  if found then
    return;
  end if;

  select coalesce(sum(p.chance_weight), 0) into v_total_weight
  from doctors.wheel_prizes p
  where p.is_active = true and p.chance_weight > 0 and p.remaining_stock > 0;

  if v_total_weight <= 0 then
    raise exception 'No wheel prizes available';
  end if;

  v_target := random() * v_total_weight;

  for v_prize in
    select * from doctors.wheel_prizes p
    where p.is_active = true and p.chance_weight > 0 and p.remaining_stock > 0
    order by p.sort_order, p.created_at
    for update
  loop
    v_running := v_running + v_prize.chance_weight;
    exit when v_target <= v_running;
  end loop;

  update doctors.wheel_prizes wp
  set remaining_stock = wp.remaining_stock - 1, updated_at = now()
  where wp.id = v_prize.id and wp.remaining_stock > 0
  returning wp.* into v_prize;

  insert into doctors.wheel_claims (doctor_id, prize_id, prize_label_snapshot, prize_note_snapshot)
  values (p_doctor_id, v_prize.id, v_prize.label, v_prize.note);

  return query
  select v_prize.id, v_prize.label, v_prize.note, v_prize.color, v_prize.text_color,
         v_prize.chance_weight, v_prize.total_stock, v_prize.remaining_stock,
         v_prize.is_active, v_prize.sort_order;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.claim_prize(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.claim_prize(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.claim_prize(uuid) TO anon;
GRANT EXECUTE ON FUNCTION doctors.claim_prize(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.claim_prize(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.create_shop_order(p_first_name text, p_last_name text, p_email text, p_mobile text, p_address text, p_city text, p_province text, p_barangay text, p_zip text, p_province_code text, p_city_municipality_code text, p_barangay_code text, p_shipping_region text, p_shipping_fee numeric, p_shipping_weight_grams integer, p_total_amount numeric, p_items jsonb, p_subtotal numeric, p_payment_method text DEFAULT 'maya'::text, p_referral_slug text DEFAULT NULL::text)
 RETURNS SETOF doctors.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_order_id uuid;
  v_referral_slug text;
  v_referral_doctor_id uuid;
begin
  v_referral_slug := nullif(lower(trim(coalesce(p_referral_slug, ''))), '');

  -- Resolve the referrer, but refuse to credit a partner for their own order.
  -- Matching on email OR mobile so a second email address is not an easy dodge.
  if v_referral_slug is not null then
    select d.id into v_referral_doctor_id
    from doctors.doctor_registrations d
    where d.routing_slug = v_referral_slug
      and lower(trim(coalesce(d.email, ''))) is distinct from lower(trim(coalesce(p_email, '')))
      and nullif(regexp_replace(coalesce(d.mobile, ''), '\D', '', 'g'), '')
          is distinct from nullif(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), '')
    limit 1;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order must include at least one item.';
  end if;

  if length(trim(coalesce(p_first_name, ''))) = 0 or length(trim(coalesce(p_last_name, ''))) = 0 then
    raise exception 'First and last name are required.';
  end if;

  insert into doctors.shop_orders (
    order_code,
    customer_name,
    first_name,
    last_name,
    email,
    mobile,
    address,
    city,
    province,
    barangay,
    zip,
    province_code,
    city_municipality_code,
    barangay_code,
    shipping_region,
    shipping_fee,
    shipping_weight_grams,
    total_amount,
    items,
    subtotal,
    payment_method,
    referral_slug,
    referral_doctor_id
  )
  values (
    doctors.generate_shop_order_code(),
    trim(p_first_name) || ' ' || trim(p_last_name),
    trim(p_first_name),
    trim(p_last_name),
    lower(trim(p_email)),
    trim(p_mobile),
    trim(p_address),
    trim(p_city),
    trim(p_province),
    trim(p_barangay),
    trim(p_zip),
    nullif(trim(coalesce(p_province_code, '')), ''),
    nullif(trim(coalesce(p_city_municipality_code, '')), ''),
    nullif(trim(coalesce(p_barangay_code, '')), ''),
    nullif(trim(coalesce(p_shipping_region, '')), ''),
    coalesce(p_shipping_fee, 0),
    coalesce(p_shipping_weight_grams, 0),
    coalesce(p_total_amount, coalesce(p_subtotal, 0) + coalesce(p_shipping_fee, 0)),
    p_items,
    coalesce(p_subtotal, 0),
    lower(trim(coalesce(p_payment_method, 'maya'))),
    v_referral_slug,
    v_referral_doctor_id
  )
  returning shop_orders.id into v_order_id;

  return query select * from doctors.admin_get_shop_order_unchecked(v_order_id);
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.generate_shop_order_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_code text;
begin
  -- 8 hex chars, not 4. get_shop_order_public exposes the order (including the delivery
  -- address) to anyone holding the code, and 4 chars is only 65k combinations per day -
  -- cheap to enumerate. 8 chars makes scraping infeasible. Older short codes still resolve.
  loop
    v_code := 'GG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from doctors.shop_orders where order_code = v_code);
  end loop;

  return v_code;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.generate_shop_order_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.generate_shop_order_code() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.generate_shop_order_code() TO anon;
GRANT EXECUTE ON FUNCTION doctors.generate_shop_order_code() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.generate_shop_order_code() TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.get_doctor_redirect(p_routing_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select redirect_url from doctors.partner_by_key(p_routing_slug);
$function$
;
REVOKE ALL ON FUNCTION doctors.get_doctor_redirect(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.get_doctor_redirect(text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.get_doctor_redirect(text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.get_doctor_redirect(text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.get_doctor_redirect(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.get_main_store_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_result jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store dashboard.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'main_store', jsonb_build_object(
      'id', v_main_store.id,
      'full_name', v_main_store.full_name,
      'routing_slug', v_main_store.routing_slug,
      'email', v_main_store.email,
      'store_type', v_main_store.store_type,
      'referral_qr_enabled', v_main_store.referral_qr_enabled
    ),
    'lifestyle_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'lifestyle'
    ),
    'affiliate_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'affiliate'
    ),
    'total_orders', (
      SELECT count(*) FROM public.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'total_revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM public.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'combined_points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id
    ),
    'own_points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id AND depth = 0
    ),
    'passup_points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points
      WHERE partner_id = v_main_store.id AND depth = 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.get_main_store_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.get_main_store_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.get_main_store_dashboard() TO anon;
GRANT EXECUTE ON FUNCTION doctors.get_main_store_dashboard() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.get_main_store_dashboard() TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.get_main_store_reports(p_scope text DEFAULT 'all'::text, p_store_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sort text DEFAULT 'newest'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total_orders bigint;
  v_orders jsonb;
  v_stores jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store reports.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_orders
  FROM public.shop_orders o
  JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
  WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
    AND (p_store_id IS NULL OR dr.id = p_store_id)
    AND doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day');

  SELECT coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) INTO v_orders
  FROM (
    SELECT o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_name', coalesce(nullif(trim(o.customer_name), ''), trim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, ''))),
      'store_id', dr.id,
      'store_name', dr.full_name,
      'store_type', dr.store_type,
      'store_slug', dr.routing_slug
    ) AS entry
    FROM public.shop_orders o
    JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
    WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
      AND (p_store_id IS NULL OR dr.id = p_store_id)
      AND doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day')
    ORDER BY
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    LIMIT v_limit OFFSET v_offset
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', dr.id,
    'full_name', dr.full_name,
    'store_type', dr.store_type,
    'routing_slug', dr.routing_slug,
    'specialty', dr.specialty,
    'practice_location', dr.practice_location,
    'created_at', dr.created_at,
    'referral_qr_enabled', dr.referral_qr_enabled,
    'orders_count', (
      SELECT count(*) FROM public.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM public.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'points', (
      SELECT coalesce(sum(points), 0) FROM doctors.partner_points pp
      WHERE pp.partner_id = dr.id
    )
  ) ORDER BY dr.created_at DESC), '[]'::jsonb) INTO v_stores
  FROM doctors.doctor_registrations dr
  WHERE dr.main_store_id = v_main_store.id;

  RETURN jsonb_build_object(
    'total_orders', v_total_orders,
    'orders', v_orders,
    'stores', v_stores
  );
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.get_partner_invitation(p_slug text)
 RETURNS TABLE(routing_slug text, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select d.routing_slug, d.full_name from doctors.partner_by_key(p_slug) d;
$function$
;
REVOKE ALL ON FUNCTION doctors.get_partner_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.get_partner_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.get_partner_invitation(text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.get_partner_invitation(text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.get_partner_invitation(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.get_referral_partner(p_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select routing_slug
  from doctors.doctor_registrations
  where routing_slug = lower(trim(p_slug))
  limit 1;
$function$
;
REVOKE ALL ON FUNCTION doctors.get_referral_partner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.get_referral_partner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.get_referral_partner(text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.get_referral_partner(text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.get_referral_partner(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.get_shop_order_public(p_order_code text)
 RETURNS TABLE(order_code text, status text, payment_status text, payment_attempts integer, maya_reference text, maya_fund_source text, first_name text, email_masked text, address text, barangay text, city text, province text, zip text, shipping_region text, shipping_fee numeric, subtotal numeric, total_amount numeric, items jsonb, created_at timestamp with time zone, paid_at timestamp with time zone, order_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select
    o.order_code,
    o.status,
    o.payment_status,
    coalesce(o.payment_attempts, 0),
    o.maya_reference,
    o.maya_fund_source,
    split_part(o.customer_name, ' ', 1),
    regexp_replace(o.email, '^(.).*@', '\1***@'),
    o.address,
    o.barangay,
    o.city,
    o.province,
    o.zip,
    o.shipping_region,
    coalesce(o.shipping_fee, 0),
    o.subtotal,
    coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
    o.items,
    o.created_at,
    o.paid_at,
    o.id
  from doctors.shop_orders o
  where upper(trim(o.order_code)) = upper(trim(p_order_code))
  limit 1;
$function$
;
REVOKE ALL ON FUNCTION doctors.get_shop_order_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.get_shop_order_public(text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.get_shop_order_public(text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.get_shop_order_public(text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.get_shop_order_public(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.list_testimonials(p_limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, display_name text, role_line text, story text, avatar_path text, photo_paths text[], video_file_id text, featured boolean, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select
    t.id, t.display_name, t.role_line, t.story,
    t.avatar_path, t.photo_paths, t.video_file_id, t.featured, t.created_at
  from doctors.testimonials t
  where t.status = 'approved'
  order by t.featured desc, t.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$function$
;
REVOKE ALL ON FUNCTION doctors.list_testimonials(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.list_testimonials(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.list_testimonials(integer) TO anon;
GRANT EXECUTE ON FUNCTION doctors.list_testimonials(integer) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.list_testimonials(integer) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.list_wheel_prizes()
 RETURNS TABLE(id uuid, label text, note text, color text, text_color text, chance_weight integer, total_stock integer, remaining_stock integer, is_active boolean, sort_order integer, claim_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select
    p.id, p.label, p.note, p.color, p.text_color,
    p.chance_weight, p.total_stock, p.remaining_stock,
    p.is_active, p.sort_order,
    coalesce(c.claim_count, 0) as claim_count
  from doctors.wheel_prizes p
  left join (
    select prize_id, count(*) as claim_count
    from doctors.wheel_claims
    group by prize_id
  ) c on c.prize_id = p.id
  where p.is_active = true
    and p.chance_weight > 0
    and p.remaining_stock > 0
  order by p.sort_order, p.created_at;
$function$
;
REVOKE ALL ON FUNCTION doctors.list_wheel_prizes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.list_wheel_prizes() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.list_wheel_prizes() TO anon;
GRANT EXECUTE ON FUNCTION doctors.list_wheel_prizes() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.list_wheel_prizes() TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.make_unique_doctor_slug(p_full_name text, p_doctor_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  base_slug text;
  candidate text;
  suffix integer := 2;
begin
  base_slug := doctors.slugify_doctor_route(p_full_name);

  if base_slug is null or base_slug = '' then
    base_slug := 'doctor';
  end if;

  candidate := base_slug;

  while exists (
    select 1
    from doctors.doctor_registrations
    where routing_slug = candidate
      and (p_doctor_id is null or id <> p_doctor_id)
  ) loop
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.make_unique_doctor_slug(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.make_unique_doctor_slug(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.make_unique_doctor_slug(text,uuid) TO anon;
GRANT EXECUTE ON FUNCTION doctors.make_unique_doctor_slug(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.make_unique_doctor_slug(text,uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.partner_by_key(p_key text)
 RETURNS SETOF doctors.doctor_registrations
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
  select d.*
  from doctors.doctor_registrations d
  where nullif(lower(trim(coalesce(p_key, ''))), '') is not null
    and (
      d.routing_slug = lower(trim(p_key))
      or d.id::text = lower(trim(p_key))
      or right(d.id::text, 5) = lower(trim(p_key))
      or right(d.id::text, 8) = lower(trim(p_key))
    )
  limit 1;
$function$
;
REVOKE ALL ON FUNCTION doctors.partner_by_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.partner_by_key(text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.partner_dashboard(p_scope text DEFAULT 'all'::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sort text DEFAULT 'newest'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
DECLARE
  v_email text;
  v_doctor doctors.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint;
  v_orders jsonb;
BEGIN
  if v_scope not in ('all', 'direct', 'referred') then
    raise exception 'Invalid order scope.' using errcode = '22023';
  end if;
  if lower(coalesce(p_sort, 'newest')) not in ('newest', 'oldest') then
    raise exception 'Invalid order sort.' using errcode = '22023';
  end if;

  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;

  select * into v_doctor
  from doctors.doctor_registrations
  where email = v_email
  limit 1;

  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from doctors.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (
      v_scope = 'all'
      or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
    )
    and doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) into v_orders
  from (
    select o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'buyer_name', coalesce(
        nullif(trim(o.customer_name), ''),
        nullif(trim(concat_ws(' ', o.first_name, o.last_name)), '')
      ),
      'buyer_email', coalesce(o.email, ''),
      'buyer_mobile', coalesce(o.mobile, ''),
      'address', coalesce(o.address, ''),
      'barangay', coalesce(o.barangay, ''),
      'zip', coalesce(o.zip, ''),
      'city', o.city,
      'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from doctors.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (
        v_scope = 'all'
        or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
      )
      and doctors.partner_order_matches_status(o.payment_status, o.status, p_status)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_doctor.id,
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        select count(*) from doctors.referral_clicks c where c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        select count(*) from doctors.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
    ),
    'points', (
      SELECT jsonb_build_object(
        'total_all_time', coalesce(sum(p.points), 0),
        'current_cycle', floor(coalesce(sum(p.points), 0) / 1500) + 1,
        'points_in_cycle', coalesce(sum(p.points), 0) % 1500
      )
      FROM doctors.partner_points p
      WHERE p.partner_id = v_doctor.id
    ),
    'rebates', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'cycle_number', m.cycle_number,
          'milestone_pts', m.milestone_pts,
          'rebate_amount', m.rebate_amount,
          'status', m.status,
          'created_at', m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
      FROM doctors.milestone_unlocks m
      WHERE m.partner_id = v_doctor.id
    ),
    'totals', (
      select jsonb_build_object(
        'direct_orders', count(*) filter (where source.id = v_doctor.id),
        'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id),
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'direct_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.id = v_doctor.id), 0),
        'referred_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.referred_by_partner_id = v_doctor.id), 0),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0),
        'referred_partners', (
          select count(*) from doctors.doctor_registrations d
          where d.referred_by_partner_id = v_doctor.id
        )
      )
      from doctors.shop_orders o
      join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object(
      'total', v_order_count,
      'limit', v_limit,
      'offset', v_offset,
      'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count
    ),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at as joined_at, jsonb_build_object(
          'full_name', child.full_name,
          'routing_slug', child.routing_slug,
          'specialty', child.specialty,
          'practice_location', child.practice_location,
          'joined_at', child.created_at,
          'orders', count(o.id),
          'paid_order_value', coalesce(sum(
            coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
          ) filter (where o.payment_status = 'paid'), 0)
        ) as entry
        from doctors.doctor_registrations child
        left join doctors.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id
        order by child.created_at desc
      ) partners
    )
  );
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.partner_dashboard(text,text,integer,integer,timestamp with time zone,timestamp with time zone,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.partner_dashboard(text,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.partner_dashboard(text,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.partner_order_matches_status(p_payment_status text, p_order_status text, p_filter text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'doctors', 'public'
AS $function$
  select case
    when nullif(lower(trim(coalesce(p_filter, ''))), '') is null then true
    when lower(trim(p_filter)) in ('pending', 'awaiting', 'awaiting_payment') then
      lower(coalesce(p_payment_status, '')) not in ('paid', 'refunded')
      and lower(coalesce(p_order_status, '')) not in ('cancelled', 'fulfilled')
    when lower(trim(p_filter)) = 'paid' then
      lower(coalesce(p_payment_status, '')) = 'paid'
      and lower(coalesce(p_order_status, '')) is distinct from 'fulfilled'
      and lower(coalesce(p_order_status, '')) is distinct from 'cancelled'
    when lower(trim(p_filter)) in ('fulfilled', 'delivered') then
      lower(coalesce(p_payment_status, '')) = 'paid'
      and lower(coalesce(p_order_status, '')) = 'fulfilled'
    when lower(trim(p_filter)) = 'refunded' then
      lower(coalesce(p_payment_status, '')) = 'refunded'
    when lower(trim(p_filter)) = 'cancelled' then
      lower(coalesce(p_order_status, '')) = 'cancelled'
      and lower(coalesce(p_payment_status, '')) is distinct from 'refunded'
    else
      lower(coalesce(p_payment_status, '')) = lower(trim(p_filter))
      or lower(coalesce(p_order_status, '')) = lower(trim(p_filter))
  end;
$function$
;
REVOKE ALL ON FUNCTION doctors.partner_order_matches_status(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.partner_order_matches_status(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION doctors.prevent_partner_referrer_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if new.referred_by_partner_id is distinct from old.referred_by_partner_id then
    raise exception 'Partner referral attribution cannot be changed.' using errcode = '23514';
  end if;
  return new;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.prevent_partner_referrer_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.prevent_partner_referrer_change() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.prevent_partner_referrer_change() TO anon;
GRANT EXECUTE ON FUNCTION doctors.prevent_partner_referrer_change() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.prevent_partner_referrer_change() TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.register_doctor(p_full_name text, p_email text, p_mobile text, p_tiktok_username text, p_specialty text, p_practice_location text, p_referrer_slug text DEFAULT NULL::text, p_name_prefix text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
DECLARE
  v_doctor_id uuid;
  v_referrer_id uuid;
  v_referrer_record doctors.doctor_registrations%ROWTYPE;
  v_main_store_id uuid;
  v_tiktok_username text;
BEGIN
  v_tiktok_username := regexp_replace(lower(trim(coalesce(p_tiktok_username, ''))), '^@+', '');
  
  IF nullif(lower(trim(coalesce(p_referrer_slug, ''))), '') IS NOT NULL THEN
    SELECT * INTO v_referrer_record
    FROM doctors.doctor_registrations d
    WHERE d.routing_slug = lower(trim(p_referrer_slug))
    LIMIT 1;

    IF v_referrer_record.id IS NOT NULL THEN
      v_referrer_id := v_referrer_record.id;
      IF v_referrer_record.store_type = 'main' THEN
        v_main_store_id := v_referrer_record.id;
      ELSE
        v_main_store_id := v_referrer_record.main_store_id;
      END IF;
    END IF;
  END IF;

  -- Fallback to default main store if no referrer or referrer has no main_store_id
  IF v_main_store_id IS NULL THEN
    SELECT id INTO v_main_store_id
    FROM doctors.doctor_registrations
    WHERE store_type = 'main'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Allocate non-colliding 5-char link key
  LOOP
    v_doctor_id := gen_random_uuid();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM doctors.doctor_registrations d
      WHERE right(d.id::text, 5) = right(v_doctor_id::text, 5)
    );
  END LOOP;

  INSERT INTO doctors.doctor_registrations (
    id, name_prefix, full_name, email, mobile, tiktok_username, specialty, practice_location,
    routing_slug, redirect_url, referred_by_partner_id,
    store_type, referral_qr_enabled, main_store_id
  ) VALUES (
    v_doctor_id,
    trim(coalesce(p_name_prefix, '')),
    trim(p_full_name),
    coalesce(nullif(lower(trim(coalesce(p_email, ''))), ''), ''),
    trim(p_mobile),
    v_tiktok_username,
    trim(p_specialty),
    trim(p_practice_location),
    doctors.make_unique_doctor_slug(p_full_name),
    case when v_tiktok_username = '' then null else 'https://www.tiktok.com/@' || v_tiktok_username end,
    v_referrer_id,
    'affiliate',
    false,
    v_main_store_id
  ) RETURNING id INTO v_doctor_id;

  IF v_referrer_id = v_doctor_id THEN
    RAISE EXCEPTION 'A partner cannot refer themselves.' USING ERRCODE = '23514';
  END IF;

  RETURN v_doctor_id;
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.register_doctor(text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.register_doctor(text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.register_doctor(text,text,text,text,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.register_doctor(text,text,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.register_doctor(text,text,text,text,text,text,text,text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.slugify_doctor_route(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select trim(
    both '-' from regexp_replace(
      regexp_replace(lower(coalesce(input, 'doctor')), '[^a-z0-9]+', '-', 'g'),
      '-+',
      '-',
      'g'
    )
  );
$function$
;
REVOKE ALL ON FUNCTION doctors.slugify_doctor_route(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.slugify_doctor_route(text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.slugify_doctor_route(text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.slugify_doctor_route(text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.slugify_doctor_route(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.submit_testimonial(p_display_name text, p_email text, p_role_line text, p_story text, p_avatar_path text, p_photo_paths text[], p_video_file_id text, p_consent boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_name text := trim(coalesce(p_display_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := trim(coalesce(p_role_line, ''));
  v_story text := trim(coalesce(p_story, ''));
  v_photos text[] := coalesce(p_photo_paths, '{}');
  v_id uuid;
  v_path text;
begin
  -- The form validates all of this too, but that is for the member's benefit. This is
  -- the copy that actually holds, because anyone can call the RPC with the anon key.
  if p_consent is not true then
    raise exception 'Consent is required to publish a story.';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Name must be between 2 and 80 characters.';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required.';
  end if;

  if char_length(v_role) > 80 then
    raise exception 'Location or role must be 80 characters or fewer.';
  end if;

  if char_length(v_story) < 40 or char_length(v_story) > 1500 then
    raise exception 'Your story must be between 40 and 1500 characters.';
  end if;

  if coalesce(array_length(v_photos, 1), 0) > 4 then
    raise exception 'Up to 4 photos may be attached.';
  end if;

  foreach v_path in array v_photos loop
    if v_path !~ '^[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp)$' then
      raise exception 'Unsupported photo attachment.';
    end if;
  end loop;

  -- ponytail: crude per-address throttle, enough to stop a bored visitor filling the
  -- moderation queue. Swap for a captcha or an edge rate limiter if it is ever abused
  -- at scale, since nothing here stops someone cycling addresses.
  if (
    select count(*)
    from doctors.testimonials
    where email = v_email
      and status = 'pending'
      and created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'You already have stories awaiting review. Please give us a day to read them.';
  end if;

  insert into doctors.testimonials (
    display_name, email, role_line, story,
    avatar_path, photo_paths, video_file_id, consent
  )
  values (
    v_name, v_email, v_role, v_story,
    nullif(trim(coalesce(p_avatar_path, '')), ''),
    v_photos,
    nullif(trim(coalesce(p_video_file_id, '')), ''),
    true
  )
  returning id into v_id;

  return v_id;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.submit_testimonial(text,text,text,text,text,text[],text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.submit_testimonial(text,text,text,text,text,text[],text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.submit_testimonial(text,text,text,text,text,text[],text,boolean) TO anon;
GRANT EXECUTE ON FUNCTION doctors.submit_testimonial(text,text,text,text,text,text[],text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.submit_testimonial(text,text,text,text,text,text[],text,boolean) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.touch_shop_order_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.touch_shop_order_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.touch_shop_order_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.touch_shop_order_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION doctors.touch_shop_order_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.touch_shop_order_updated_at() TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.touch_tiktok_credentials_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.touch_tiktok_credentials_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.touch_tiktok_credentials_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.touch_tiktok_credentials_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION doctors.touch_tiktok_credentials_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.touch_tiktok_credentials_updated_at() TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.touch_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.touch_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.touch_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION doctors.touch_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.touch_updated_at() TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.track_referral_click(p_slug text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
declare
  v_slug text;
  v_doctor_id uuid;
begin
  -- p_slug is the partner id on new QR codes and the routing slug on older printed ones.
  select d.routing_slug, d.id into v_slug, v_doctor_id
  from doctors.partner_by_key(p_slug) d;

  -- Unknown slug: no row, no click. Counting misses would let anyone inflate a partner's
  -- numbers by hitting /r/<anything>.
  if v_slug is null then
    return null;
  end if;

  insert into doctors.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

  return v_slug;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.track_referral_click(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.track_referral_click(text) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.track_referral_click(text) TO anon;
GRANT EXECUTE ON FUNCTION doctors.track_referral_click(text) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.track_referral_click(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.update_doctor_task(p_doctor_id uuid, p_task text, p_value boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'doctors', 'public'
AS $function$
begin
  if p_task not in ('email', 'facebook', 'tiktok', 'reel') then
    raise exception 'Invalid task: %', p_task;
  end if;

  update doctors.doctor_registrations
  set
    task_email_received = case when p_task = 'email' then p_value else task_email_received end,
    task_facebook_followed = case when p_task = 'facebook' then p_value else task_facebook_followed end,
    task_tiktok_followed = case when p_task = 'tiktok' then p_value else task_tiktok_followed end,
    task_reel_created = case when p_task = 'reel' then p_value else task_reel_created end
  where id = p_doctor_id;

  if not found then
    raise exception 'Doctor registration not found';
  end if;
end;
$function$
;
REVOKE ALL ON FUNCTION doctors.update_doctor_task(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.update_doctor_task(uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.update_doctor_task(uuid,text,boolean) TO anon;
GRANT EXECUTE ON FUNCTION doctors.update_doctor_task(uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION doctors.update_doctor_task(uuid,text,boolean) TO PUBLIC;

CREATE OR REPLACE FUNCTION doctors.validate_main_store_reference()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_target_type doctors.store_type;
BEGIN
  IF NEW.main_store_id IS NOT NULL THEN
    SELECT store_type INTO v_target_type
    FROM doctors.doctor_registrations
    WHERE id = NEW.main_store_id;

    IF v_target_type IS NULL OR v_target_type != 'main' THEN
      RAISE EXCEPTION 'main_store_id must reference an account with store_type = main';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
REVOKE ALL ON FUNCTION doctors.validate_main_store_reference() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctors.validate_main_store_reference() TO authenticated;
GRANT EXECUTE ON FUNCTION doctors.validate_main_store_reference() TO anon;
GRANT EXECUTE ON FUNCTION doctors.validate_main_store_reference() TO service_role;
GRANT EXECUTE ON FUNCTION doctors.validate_main_store_reference() TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.admin_get_shop_order(p_admin_password text, p_order_id uuid)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query select * from sandbox.admin_get_shop_order_unchecked(p_order_id);
end;
$function$
;
REVOKE ALL ON FUNCTION sandbox.admin_get_shop_order(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.admin_get_shop_order(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.admin_get_shop_order_unchecked(p_order_id uuid)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
  select * from sandbox.shop_orders where id = p_order_id limit 1;
$function$
;
REVOKE ALL ON FUNCTION sandbox.admin_get_shop_order_unchecked(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.admin_get_shop_order_unchecked(uuid) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.admin_list_shop_orders(p_admin_password text)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select * from sandbox.shop_orders order by created_at desc;
end;
$function$
;
REVOKE ALL ON FUNCTION sandbox.admin_list_shop_orders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.admin_list_shop_orders(text) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.admin_update_shop_order(p_admin_password text, p_order_id uuid, p_status text, p_payment_status text, p_maya_reference text DEFAULT NULL::text, p_admin_notes text DEFAULT NULL::text)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  update sandbox.shop_orders
  set
    status = p_status,
    payment_status = p_payment_status,
    maya_reference = nullif(trim(coalesce(p_maya_reference, '')), ''),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    paid_at = case when p_payment_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where shop_orders.id = p_order_id;

  return query select * from sandbox.admin_get_shop_order_unchecked(p_order_id);
end;
$function$
;
REVOKE ALL ON FUNCTION sandbox.admin_update_shop_order(text,uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.admin_update_shop_order(text,uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.award_order_points()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_points INTEGER;
  v_partner doctors.doctor_registrations%ROWTYPE;
BEGIN
  v_points := FLOOR(COALESCE(NEW.total_amount, 0) / 1000);
  IF v_points < 1 THEN
    v_points := 1;
  END IF;

  IF NEW.referral_doctor_id IS NOT NULL THEN
    SELECT * INTO v_partner
    FROM doctors.doctor_registrations
    WHERE id = NEW.referral_doctor_id;

    IF v_partner.id IS NOT NULL THEN
      INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
      VALUES (NEW.id, v_partner.id, v_points, 0)
      ON CONFLICT (order_id, partner_id) DO NOTHING;

      IF v_partner.referred_by_partner_id IS NOT NULL THEN
        INSERT INTO sandbox.partner_points (order_id, partner_id, points, depth)
        VALUES (NEW.id, v_partner.referred_by_partner_id, v_points, 1)
        ON CONFLICT (order_id, partner_id) DO NOTHING;
      END IF;

      IF v_partner.store_type = 'affiliate' THEN
        UPDATE doctors.doctor_registrations
        SET store_type = 'lifestyle',
            referral_qr_enabled = true,
            promoted_at = now(),
            promoted_by = 'auto'
        WHERE id = v_partner.id;

        INSERT INTO sandbox.store_promotions (
          partner_id, from_type, to_type, trigger_type, trigger_order_id
        ) VALUES (
          v_partner.id, 'affiliate', 'lifestyle', 'first_sale', NEW.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
REVOKE ALL ON FUNCTION sandbox.award_order_points() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.award_order_points() TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.award_order_points() TO anon;
GRANT EXECUTE ON FUNCTION sandbox.award_order_points() TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.award_order_points() TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.calculate_order_points(p_items jsonb, p_total_amount numeric DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_points integer := 0;
  v_item jsonb;
  v_caps integer;
BEGIN
  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_caps := COALESCE((v_item->>'caps')::integer, 0);
      IF v_caps > 0 THEN
        v_points := v_points + (v_caps * COALESCE((v_item->>'qty')::integer, COALESCE((v_item->>'quantity')::integer, 1))) / 10;
      END IF;
    END LOOP;
  END IF;
  IF v_points = 0 AND p_total_amount > 0 THEN
    v_points := CASE
      WHEN p_total_amount >= 29000 THEN 33
      WHEN p_total_amount >= 10000 THEN 9
      WHEN p_total_amount >= 3000  THEN 3
      ELSE 1
    END;
  END IF;
  RETURN v_points;
END;
$function$
;
REVOKE ALL ON FUNCTION sandbox.calculate_order_points(jsonb,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.calculate_order_points(jsonb,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.calculate_order_points(jsonb,numeric) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.calculate_order_points(jsonb,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.calculate_order_points(jsonb,numeric) TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.calculate_order_points(p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_points integer := 0;
  v_item jsonb;
BEGIN
  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_points := v_points + (COALESCE((v_item->>'caps')::integer, 0) * COALESCE((v_item->>'qty')::integer, 1)) / 10;
    END LOOP;
  END IF;
  RETURN v_points;
END;
$function$
;
REVOKE ALL ON FUNCTION sandbox.calculate_order_points(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.calculate_order_points(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.calculate_order_points(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.calculate_order_points(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.calculate_order_points(jsonb) TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.create_shop_order(p_first_name text, p_last_name text, p_email text, p_mobile text, p_address text, p_city text, p_province text, p_barangay text, p_zip text, p_province_code text, p_city_municipality_code text, p_barangay_code text, p_shipping_region text, p_shipping_fee numeric, p_shipping_weight_grams integer, p_total_amount numeric, p_items jsonb, p_subtotal numeric, p_payment_method text DEFAULT 'maya'::text, p_referral_slug text DEFAULT NULL::text)
 RETURNS SETOF sandbox.shop_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
declare
  v_order_id uuid;
  v_referral_slug text;
  v_referral_doctor_id uuid;
begin
  v_referral_slug := nullif(lower(trim(coalesce(p_referral_slug, ''))), '');

  -- Resolve the referrer, but refuse to credit a partner for their own order.
  -- Matching on email OR mobile so a second email address is not an easy dodge.
  if v_referral_slug is not null then
    select d.id into v_referral_doctor_id
    from doctors.doctor_registrations d
    where d.routing_slug = v_referral_slug
      and lower(trim(coalesce(d.email, ''))) is distinct from lower(trim(coalesce(p_email, '')))
      and nullif(regexp_replace(coalesce(d.mobile, ''), '\D', '', 'g'), '')
          is distinct from nullif(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), '')
    limit 1;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order must include at least one item.';
  end if;

  if length(trim(coalesce(p_first_name, ''))) = 0 or length(trim(coalesce(p_last_name, ''))) = 0 then
    raise exception 'First and last name are required.';
  end if;

  insert into sandbox.shop_orders (
    order_code,
    customer_name,
    first_name,
    last_name,
    email,
    mobile,
    address,
    city,
    province,
    barangay,
    zip,
    province_code,
    city_municipality_code,
    barangay_code,
    shipping_region,
    shipping_fee,
    shipping_weight_grams,
    total_amount,
    items,
    subtotal,
    payment_method,
    referral_slug,
    referral_doctor_id
  )
  values (
    sandbox.generate_shop_order_code(),
    trim(p_first_name) || ' ' || trim(p_last_name),
    trim(p_first_name),
    trim(p_last_name),
    lower(trim(p_email)),
    trim(p_mobile),
    trim(p_address),
    trim(p_city),
    trim(p_province),
    trim(p_barangay),
    trim(p_zip),
    nullif(trim(coalesce(p_province_code, '')), ''),
    nullif(trim(coalesce(p_city_municipality_code, '')), ''),
    nullif(trim(coalesce(p_barangay_code, '')), ''),
    nullif(trim(coalesce(p_shipping_region, '')), ''),
    coalesce(p_shipping_fee, 0),
    coalesce(p_shipping_weight_grams, 0),
    coalesce(p_total_amount, coalesce(p_subtotal, 0) + coalesce(p_shipping_fee, 0)),
    p_items,
    coalesce(p_subtotal, 0),
    lower(trim(coalesce(p_payment_method, 'maya'))),
    v_referral_slug,
    v_referral_doctor_id
  )
  returning shop_orders.id into v_order_id;

  return query select * from sandbox.admin_get_shop_order_unchecked(v_order_id);
end;
$function$
;
REVOKE ALL ON FUNCTION sandbox.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.create_shop_order(text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,integer,numeric,jsonb,numeric,text,text) TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.generate_shop_order_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
declare
  v_code text;
begin
  -- 8 hex chars, not 4. get_shop_order_public exposes the order (including the delivery
  -- address) to anyone holding the code, and 4 chars is only 65k combinations per day -
  -- cheap to enumerate. 8 chars makes scraping infeasible. Older short codes still resolve.
  loop
    v_code := 'GG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from sandbox.shop_orders where order_code = v_code);
  end loop;

  return v_code;
end;
$function$
;
REVOKE ALL ON FUNCTION sandbox.generate_shop_order_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.generate_shop_order_code() TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.generate_shop_order_code() TO anon;
GRANT EXECUTE ON FUNCTION sandbox.generate_shop_order_code() TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.generate_shop_order_code() TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.get_main_store_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_result jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store dashboard.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'main_store', jsonb_build_object(
      'id', v_main_store.id,
      'full_name', v_main_store.full_name,
      'routing_slug', v_main_store.routing_slug,
      'email', v_main_store.email,
      'store_type', v_main_store.store_type,
      'referral_qr_enabled', v_main_store.referral_qr_enabled
    ),
    'lifestyle_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'lifestyle'
    ),
    'affiliate_count', (
      SELECT count(*) FROM doctors.doctor_registrations
      WHERE main_store_id = v_main_store.id AND store_type = 'affiliate'
    ),
    'total_orders', (
      SELECT count(*) FROM sandbox.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'total_revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM sandbox.shop_orders so
      JOIN doctors.doctor_registrations dr ON so.referral_doctor_id = dr.id
      WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
        AND so.payment_status = 'paid'
    ),
    'combined_points', (
      SELECT coalesce(sum(points), 0) FROM sandbox.partner_points
      WHERE partner_id = v_main_store.id
    ),
    'own_points', (
      SELECT coalesce(sum(points), 0) FROM sandbox.partner_points
      WHERE partner_id = v_main_store.id AND depth = 0
    ),
    'passup_points', (
      SELECT coalesce(sum(points), 0) FROM sandbox.partner_points
      WHERE partner_id = v_main_store.id AND depth = 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$
;
REVOKE ALL ON FUNCTION sandbox.get_main_store_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_dashboard() TO anon;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_dashboard() TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_dashboard() TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.get_main_store_reports(p_main_store_id uuid, p_store_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
DECLARE
  v_stores jsonb;
  v_orders jsonb;
  v_total_orders integer;
BEGIN
  -- 1. Get descendant stores list
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', dr.id,
    'full_name', dr.full_name,
    'routing_slug', dr.routing_slug,
    'store_type', dr.store_type,
    'specialty', dr.specialty,
    'referral_qr_enabled', dr.referral_qr_enabled,
    'created_at', dr.created_at,
    'total_orders', COALESCE(ord_stats.cnt, 0),
    'total_revenue', COALESCE(ord_stats.rev, 0),
    'total_points_earned', (
      SELECT COUNT(*) FROM sandbox.partner_points pp WHERE pp.partner_id = dr.id
    )
  )), '[]'::jsonb)
  INTO v_stores
  FROM doctors.doctor_registrations dr
  LEFT JOIN (
    SELECT doctor_id, COUNT(*) as cnt, SUM(total_amount) as rev
    FROM sandbox.shop_orders
    WHERE status != 'cancelled'
    GROUP BY doctor_id
  ) ord_stats ON ord_stats.doctor_id = dr.id
  WHERE dr.main_store_id = p_main_store_id;

  -- 2. Count total orders matching filter
  SELECT COUNT(*)
  INTO v_total_orders
  FROM sandbox.shop_orders so
  JOIN doctors.doctor_registrations dr ON dr.id = so.doctor_id
  WHERE (dr.main_store_id = p_main_store_id OR dr.id = p_main_store_id)
    AND (p_store_id IS NULL OR so.doctor_id = p_store_id)
    AND (p_status IS NULL OR so.status = p_status)
    AND (p_date_from IS NULL OR so.created_at >= p_date_from)
    AND (p_date_to IS NULL OR so.created_at <= p_date_to);

  -- 3. Get paginated orders list with full details
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', so.id,
    'order_code', so.order_code,
    'doctor_id', so.doctor_id,
    'store_name', dr.full_name,
    'store_type', dr.store_type,
    'routing_slug', dr.routing_slug,
    'customer_name', so.customer_name,
    'email', so.email,
    'mobile', so.mobile,
    'address', so.address,
    'city', so.city,
    'province', so.province,
    'barangay', so.barangay,
    'zip', so.zip,
    'subtotal', so.subtotal,
    'shipping_fee', so.shipping_fee,
    'total_amount', so.total_amount,
    'status', so.status,
    'payment_method', so.payment_method,
    'maya_reference', so.maya_reference,
    'maya_payment_status', so.maya_payment_status,
    'maya_fund_source', so.maya_fund_source,
    'paid_at', so.paid_at,
    'created_at', so.created_at,
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'product_name', coi.product_name,
        'quantity', coi.quantity,
        'unit_price', coi.unit_price,
        'total_price', coi.total_price
      )), '[]'::jsonb)
      FROM sandbox.shop_order_items coi
      WHERE coi.order_id = so.id
    )
  ) ORDER BY so.created_at DESC), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT *
    FROM sandbox.shop_orders so
    JOIN doctors.doctor_registrations dr ON dr.id = so.doctor_id
    WHERE (dr.main_store_id = p_main_store_id OR dr.id = p_main_store_id)
      AND (p_store_id IS NULL OR so.doctor_id = p_store_id)
      AND (p_status IS NULL OR so.status = p_status)
      AND (p_date_from IS NULL OR so.created_at >= p_date_from)
      AND (p_date_to IS NULL OR so.created_at <= p_date_to)
    ORDER BY so.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) so
  JOIN doctors.doctor_registrations dr ON dr.id = so.doctor_id;

  RETURN jsonb_build_object(
    'stores', v_stores,
    'orders', v_orders,
    'total_orders', v_total_orders
  );
END;
$function$
;
REVOKE ALL ON FUNCTION sandbox.get_main_store_reports(uuid,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_reports(uuid,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_reports(uuid,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_reports(uuid,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_reports(uuid,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer) TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.get_main_store_reports(p_scope text DEFAULT 'all'::text, p_store_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sort text DEFAULT 'newest'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
DECLARE
  v_email text;
  v_main_store doctors.doctor_registrations%ROWTYPE;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total_orders bigint;
  v_orders jsonb;
  v_stores jsonb;
BEGIN
  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to view Main Store reports.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_main_store
  FROM doctors.doctor_registrations
  WHERE email = v_email AND store_type = 'main'
  LIMIT 1;

  IF v_main_store.id IS NULL THEN
    RAISE EXCEPTION 'This account is not a GutGuard Main Store.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_orders
  FROM sandbox.shop_orders o
  JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
  WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
    AND (p_store_id IS NULL OR dr.id = p_store_id)
    AND sandbox.partner_order_matches_status(o.payment_status, o.status, p_status)
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day');

  SELECT coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) INTO v_orders
  FROM (
    SELECT o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_name', coalesce(nullif(trim(o.customer_name), ''), trim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, ''))),
      'store_id', dr.id,
      'store_name', dr.full_name,
      'store_type', dr.store_type,
      'store_slug', dr.routing_slug
    ) AS entry
    FROM sandbox.shop_orders o
    JOIN doctors.doctor_registrations dr ON o.referral_doctor_id = dr.id
    WHERE (dr.main_store_id = v_main_store.id OR dr.id = v_main_store.id)
      AND (p_store_id IS NULL OR dr.id = p_store_id)
      AND sandbox.partner_order_matches_status(o.payment_status, o.status, p_status)
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at < p_date_to + interval '1 day')
    ORDER BY
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    LIMIT v_limit OFFSET v_offset
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', dr.id,
    'full_name', dr.full_name,
    'store_type', dr.store_type,
    'routing_slug', dr.routing_slug,
    'specialty', dr.specialty,
    'practice_location', dr.practice_location,
    'created_at', dr.created_at,
    'referral_qr_enabled', dr.referral_qr_enabled,
    'orders_count', (
      SELECT count(*) FROM sandbox.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'revenue', (
      SELECT coalesce(sum(so.total_amount), 0) FROM sandbox.shop_orders so
      WHERE so.referral_doctor_id = dr.id AND so.payment_status = 'paid'
    ),
    'points', (
      SELECT coalesce(sum(points), 0) FROM sandbox.partner_points pp
      WHERE pp.partner_id = dr.id
    )
  ) ORDER BY dr.created_at DESC), '[]'::jsonb) INTO v_stores
  FROM doctors.doctor_registrations dr
  WHERE dr.main_store_id = v_main_store.id;

  RETURN jsonb_build_object(
    'total_orders', v_total_orders,
    'orders', v_orders,
    'stores', v_stores
  );
END;
$function$
;
REVOKE ALL ON FUNCTION sandbox.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.get_main_store_reports(text,uuid,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.get_referral_partner(p_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
  select routing_slug
  from doctors.doctor_registrations
  where routing_slug = lower(trim(p_slug))
  limit 1;
$function$
;
REVOKE ALL ON FUNCTION sandbox.get_referral_partner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.get_referral_partner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.get_referral_partner(text) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.get_referral_partner(text) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.get_referral_partner(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.get_shop_order_public(p_order_code text)
 RETURNS TABLE(order_code text, status text, payment_status text, payment_attempts integer, maya_reference text, maya_fund_source text, first_name text, email_masked text, address text, barangay text, city text, province text, zip text, shipping_region text, shipping_fee numeric, subtotal numeric, total_amount numeric, items jsonb, created_at timestamp with time zone, paid_at timestamp with time zone, order_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
  select
    o.order_code,
    o.status,
    o.payment_status,
    coalesce(o.payment_attempts, 0),
    o.maya_reference,
    o.maya_fund_source,
    split_part(o.customer_name, ' ', 1),
    regexp_replace(o.email, '^(.).*@', '\1***@'),
    o.address,
    o.barangay,
    o.city,
    o.province,
    o.zip,
    o.shipping_region,
    coalesce(o.shipping_fee, 0),
    o.subtotal,
    coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
    o.items,
    o.created_at,
    o.paid_at,
    o.id
  from sandbox.shop_orders o
  where upper(trim(o.order_code)) = upper(trim(p_order_code))
  limit 1;
$function$
;
REVOKE ALL ON FUNCTION sandbox.get_shop_order_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.get_shop_order_public(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.get_shop_order_public(text) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.get_shop_order_public(text) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.get_shop_order_public(text) TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.partner_dashboard(p_scope text DEFAULT 'all'::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sort text DEFAULT 'newest'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
DECLARE
  v_email text;
  v_doctor doctors.doctor_registrations;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_order_count bigint;
  v_orders jsonb;
BEGIN
  if v_scope not in ('all', 'direct', 'referred') then
    raise exception 'Invalid order scope.' using errcode = '22023';
  end if;
  if lower(coalesce(p_sort, 'newest')) not in ('newest', 'oldest') then
    raise exception 'Invalid order sort.' using errcode = '22023';
  end if;

  v_email := nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null then
    raise exception 'Sign in to view your dashboard.' using errcode = '42501';
  end if;

  select * into v_doctor
  from doctors.doctor_registrations
  where email = v_email
  limit 1;

  if v_doctor.id is null then
    raise exception 'This email is not registered as a GutGuard partner.' using errcode = '42501';
  end if;

  select count(*) into v_order_count
  from sandbox.shop_orders o
  join doctors.doctor_registrations source on source.id = o.referral_doctor_id
  where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
    and (
      v_scope = 'all'
      or (v_scope = 'direct' and source.id = v_doctor.id)
      or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
    )
    and sandbox.partner_order_matches_status(o.payment_status, o.status, p_status)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at < p_date_to + interval '1 day');

  select coalesce(jsonb_agg(entry order by
    case when lower(coalesce(p_sort, 'newest')) = 'oldest' then sort_at end asc,
    case when lower(coalesce(p_sort, 'newest')) = 'newest' then sort_at end desc
  ), '[]'::jsonb) into v_orders
  from (
    select o.created_at as sort_at, jsonb_build_object(
      'order_code', o.order_code,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'total_amount', coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0)),
      'buyer_first_name', coalesce(o.first_name, split_part(o.customer_name, ' ', 1)),
      'buyer_name', coalesce(
        nullif(trim(o.customer_name), ''),
        nullif(trim(concat_ws(' ', o.first_name, o.last_name)), '')
      ),
      'buyer_email', coalesce(o.email, ''),
      'buyer_mobile', coalesce(o.mobile, ''),
      'address', coalesce(o.address, ''),
      'barangay', coalesce(o.barangay, ''),
      'zip', coalesce(o.zip, ''),
      'city', o.city,
      'province', o.province,
      'source_type', case when source.id = v_doctor.id then 'direct' else 'referred' end,
      'source_partner_name', source.full_name,
      'source_partner_slug', source.routing_slug
    ) as entry
    from sandbox.shop_orders o
    join doctors.doctor_registrations source on source.id = o.referral_doctor_id
    where (source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id)
      and (
        v_scope = 'all'
        or (v_scope = 'direct' and source.id = v_doctor.id)
        or (v_scope = 'referred' and source.referred_by_partner_id = v_doctor.id)
      )
      and sandbox.partner_order_matches_status(o.payment_status, o.status, p_status)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at < p_date_to + interval '1 day')
    order by
      case when lower(coalesce(p_sort, 'newest')) = 'oldest' then o.created_at end asc,
      case when lower(coalesce(p_sort, 'newest')) = 'newest' then o.created_at end desc
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_doctor.id,
      'full_name', v_doctor.full_name,
      'routing_slug', v_doctor.routing_slug,
      'store_type', v_doctor.store_type,
      'referral_qr_enabled', v_doctor.referral_qr_enabled,
      'main_store_id', v_doctor.main_store_id,
      'promoted_at', v_doctor.promoted_at,
      'promoted_by', v_doctor.promoted_by,
      'joined_at', v_doctor.created_at
    ),
    'clicks', jsonb_build_object(
      'total', (
        select count(*) from sandbox.referral_clicks c where c.doctor_id = v_doctor.id
      ),
      'last_30_days', (
        select count(*) from sandbox.referral_clicks c
        where c.doctor_id = v_doctor.id and c.created_at >= now() - interval '30 days'
      )
    ),
    'points', (
      SELECT jsonb_build_object(
        'total_all_time', coalesce(sum(p.points), 0),
        'own_points', coalesce(sum(p.points) filter (where p.depth = 0), 0),
        'passup_points', coalesce(sum(p.points) filter (where p.depth = 1), 0),
        'current_cycle', floor(coalesce(sum(p.points), 0) / 1500) + 1,
        'points_in_cycle', coalesce(sum(p.points), 0) % 1500
      )
      FROM sandbox.partner_points p
      WHERE p.partner_id = v_doctor.id
    ),
    'rebates', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'cycle_number', m.cycle_number,
          'milestone_pts', m.milestone_pts,
          'rebate_amount', m.rebate_amount,
          'status', m.status,
          'created_at', m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
      FROM sandbox.milestone_unlocks m
      WHERE m.partner_id = v_doctor.id
    ),
    'point_sources', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'order_code', coalesce(o.order_code, pp.order_id::text),
          'points', pp.points,
          'depth', pp.depth,
          'source_partner', coalesce(seller.full_name, 'Direct Customer'),
          'created_at', pp.created_at
        ) ORDER BY pp.created_at DESC
      ), '[]'::jsonb)
      FROM sandbox.partner_points pp
      LEFT JOIN sandbox.shop_orders o ON o.id = pp.order_id
      LEFT JOIN doctors.doctor_registrations seller ON seller.id = o.referral_doctor_id
      WHERE pp.partner_id = v_doctor.id
    ),
    'totals', (
      select jsonb_build_object(
        'direct_orders', count(*) filter (where source.id = v_doctor.id),
        'referred_orders', count(*) filter (where source.referred_by_partner_id = v_doctor.id),
        'orders', count(*),
        'paid_orders', count(*) filter (where o.payment_status = 'paid'),
        'direct_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.id = v_doctor.id), 0),
        'referred_paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid' and source.referred_by_partner_id = v_doctor.id), 0),
        'paid_amount', coalesce(sum(
          coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
        ) filter (where o.payment_status = 'paid'), 0),
        'referred_partners', (
          select count(*) from doctors.doctor_registrations d
          where d.referred_by_partner_id = v_doctor.id
        )
      )
      from sandbox.shop_orders o
      join doctors.doctor_registrations source on source.id = o.referral_doctor_id
      where source.id = v_doctor.id or source.referred_by_partner_id = v_doctor.id
    ),
    'orders', v_orders,
    'orders_page', jsonb_build_object(
      'total', v_order_count,
      'limit', v_limit,
      'offset', v_offset,
      'has_more', v_offset + jsonb_array_length(v_orders) < v_order_count
    ),
    'referred_partners', (
      select coalesce(jsonb_agg(entry order by joined_at desc), '[]'::jsonb)
      from (
        select child.created_at as joined_at, jsonb_build_object(
          'full_name', child.full_name,
          'routing_slug', child.routing_slug,
          'specialty', child.specialty,
          'practice_location', child.practice_location,
          'store_type', child.store_type,
          'referral_qr_enabled', child.referral_qr_enabled,
          'joined_at', child.created_at,
          'orders', count(o.id),
          'paid_order_value', coalesce(sum(
            coalesce(nullif(o.total_amount, 0), o.subtotal + coalesce(o.shipping_fee, 0))
          ) filter (where o.payment_status = 'paid'), 0)
        ) as entry
        from doctors.doctor_registrations child
        left join sandbox.shop_orders o on o.referral_doctor_id = child.id
        where child.referred_by_partner_id = v_doctor.id
        group by child.id
        order by child.created_at desc
      ) partners
    )
  );
END;
$function$
;
REVOKE ALL ON FUNCTION sandbox.partner_dashboard(text,text,integer,integer,timestamp with time zone,timestamp with time zone,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.partner_dashboard(text,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.partner_dashboard(text,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.partner_dashboard(text,text,integer,integer,timestamp with time zone,timestamp with time zone,text) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.partner_order_matches_status(p_payment_status text, p_order_status text, p_filter text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
  select doctors.partner_order_matches_status(p_payment_status, p_order_status, p_filter);
$function$
;
REVOKE ALL ON FUNCTION sandbox.partner_order_matches_status(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.partner_order_matches_status(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.register_doctor(p_full_name text, p_email text, p_mobile text, p_tiktok_username text, p_specialty text, p_practice_location text, p_referrer_slug text DEFAULT NULL::text, p_name_prefix text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
BEGIN
  RETURN doctors.register_doctor(
    p_full_name, p_email, p_mobile, p_tiktok_username,
    p_specialty, p_practice_location, p_referrer_slug, p_name_prefix
  );
END;
$function$
;
REVOKE ALL ON FUNCTION sandbox.register_doctor(text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.register_doctor(text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.register_doctor(text,text,text,text,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.register_doctor(text,text,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.register_doctor(text,text,text,text,text,text,text,text) TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.shop_cancel_unpaid_watch(p_mobile text)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'sandbox'
AS $function$
        with n as (select right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10) as d),
        upd as (
          update sandbox.shop_orders o
             set status = 'cancelled', updated_at = now()
            from n
           where o.payment_status = 'pending'
             and o.status = 'pending_payment'
             and o.items @> '[{"id":"watch"}]'::jsonb
             and right(regexp_replace(
                   case when o.for_other then coalesce(o.recipient_mobile, '') else coalesce(o.mobile, '') end,
                   '\D', '', 'g'), 10) = n.d
          returning 1
        )
        select count(*)::integer from upd;
      $function$
;
REVOKE ALL ON FUNCTION sandbox.shop_cancel_unpaid_watch(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.shop_cancel_unpaid_watch(text) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.shop_watch_eligible(p_mobile text, p_exclude uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox'
AS $function$
        with n as (select right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10) as d)
        select length((select d from n)) = 10
          and not exists (
            select 1
            from sandbox.shop_orders o, n
            where (p_exclude is null or o.id <> p_exclude)
              and right(regexp_replace(
                    case when o.for_other then coalesce(o.recipient_mobile, '') else coalesce(o.mobile, '') end,
                    '\D', '', 'g'), 10) = n.d
              and (
                (o.payment_status = 'paid' and o.created_at > now() - interval '12 months')
                or (o.payment_status in ('pending', 'review')
                    and o.status <> 'cancelled'
                    and o.items @> '[{"id":"watch"}]'::jsonb
                    and o.created_at > now() - interval '24 hours')
              )
          );
      $function$
;
REVOKE ALL ON FUNCTION sandbox.shop_watch_eligible(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.shop_watch_eligible(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.shop_watch_gifts(p_payer_mobile text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sandbox'
AS $function$
        select count(*)::integer
        from sandbox.shop_orders o
        where o.for_other
          and o.payment_status = 'paid'
          and o.items @> '[{"id":"watch"}]'::jsonb
          and o.created_at > now() - interval '12 months'
          and right(regexp_replace(coalesce(o.mobile, ''), '\D', '', 'g'), 10)
            = right(regexp_replace(coalesce(p_payer_mobile, ''), '\D', '', 'g'), 10);
      $function$
;
REVOKE ALL ON FUNCTION sandbox.shop_watch_gifts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.shop_watch_gifts(text) TO service_role;

CREATE OR REPLACE FUNCTION sandbox.touch_shop_order_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
REVOKE ALL ON FUNCTION sandbox.touch_shop_order_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.touch_shop_order_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.touch_shop_order_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION sandbox.touch_shop_order_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.touch_shop_order_updated_at() TO PUBLIC;

CREATE OR REPLACE FUNCTION sandbox.track_referral_click(p_slug text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sandbox', 'doctors', 'public'
AS $function$
      declare
        v_slug text;
        v_doctor_id uuid;
      begin
        select d.routing_slug, d.id into v_slug, v_doctor_id
        from doctors.partner_by_key(p_slug) d;

        if v_slug is null then
          return null;
        end if;

        insert into sandbox.referral_clicks (routing_slug, doctor_id) values (v_slug, v_doctor_id);

        return v_slug;
      end;
      $function$
;
REVOKE ALL ON FUNCTION sandbox.track_referral_click(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sandbox.track_referral_click(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox.track_referral_click(text) TO anon;
GRANT EXECUTE ON FUNCTION sandbox.track_referral_click(text) TO service_role;
GRANT EXECUTE ON FUNCTION sandbox.track_referral_click(text) TO PUBLIC;
-- VIEWS

-- TRIGGERS
CREATE TRIGGER touch_tiktok_credentials_updated_at BEFORE UPDATE ON doctors.tiktok_credentials FOR EACH ROW EXECUTE FUNCTION doctors.touch_tiktok_credentials_updated_at();
CREATE TRIGGER shop_orders_touch_updated_at BEFORE UPDATE ON sandbox.shop_orders FOR EACH ROW EXECUTE FUNCTION sandbox.touch_shop_order_updated_at();
CREATE TRIGGER trigger_award_points AFTER UPDATE OF payment_status ON sandbox.shop_orders FOR EACH ROW WHEN (((new.payment_status = 'paid'::text) AND (old.payment_status <> 'paid'::text))) EXECUTE FUNCTION sandbox.award_order_points();
CREATE TRIGGER shop_orders_touch_updated_at BEFORE UPDATE ON doctors.shop_orders FOR EACH ROW EXECUTE FUNCTION doctors.touch_shop_order_updated_at();
CREATE TRIGGER trigger_award_points AFTER UPDATE OF payment_status ON doctors.shop_orders FOR EACH ROW WHEN (((new.payment_status = 'paid'::text) AND (old.payment_status <> 'paid'::text))) EXECUTE FUNCTION doctors.award_order_points();
CREATE TRIGGER doctor_registrations_referrer_immutable BEFORE UPDATE OF referred_by_partner_id ON doctors.doctor_registrations FOR EACH ROW EXECUTE FUNCTION doctors.prevent_partner_referrer_change();
CREATE TRIGGER doctor_registrations_touch_updated_at BEFORE UPDATE ON doctors.doctor_registrations FOR EACH ROW EXECUTE FUNCTION doctors.touch_updated_at();
CREATE TRIGGER trigger_validate_main_store_ref BEFORE INSERT OR UPDATE OF main_store_id ON doctors.doctor_registrations FOR EACH ROW EXECUTE FUNCTION doctors.validate_main_store_reference();
-- public.assert_wheel_admin as live in prod (anon-executable, no search_path)
CREATE OR REPLACE FUNCTION public.assert_wheel_admin(p_admin_password text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN PERFORM doctors.assert_wheel_admin(p_admin_password); END; $$;
GRANT EXECUTE ON FUNCTION public.assert_wheel_admin(text) TO anon, authenticated, service_role;
