-- 006: What happens when a professional stops paying + admin-managed ads
-- Run in the Supabase SQL Editor after 005_pro_info_document_rounds_notes.sql.
--
-- Decided 2026-11-15:
-- - A failed payment gives 14 days of full access (grace) while Stripe retries.
-- - After the subscription ends, the professional keeps their account (role stays 'investor')
--   with 14 days of read-only access, hidden from the directory.
-- - Their homeowners are told and can choose someone new; once read-only access ends, the
--   case is closed with closed_reason 'professional_inactive'. History stays.
-- - Ads are managed by SonderBe admins; each ad has a private report link for the advertiser.

ALTER TABLE investor_subscriptions
  ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

ALTER TABLE match_requests
  ADD COLUMN IF NOT EXISTS closed_reason TEXT CHECK (closed_reason IN ('professional_inactive'));

ALTER TABLE service_ads
  ADD COLUMN IF NOT EXISTS contact_name TEXT CHECK (char_length(contact_name) <= 120),
  ADD COLUMN IF NOT EXISTS contact_email TEXT CHECK (char_length(contact_email) <= 254),
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10, 2) CHECK (monthly_price IS NULL OR monthly_price >= 0),
  ADD COLUMN IF NOT EXISTS internal_notes TEXT CHECK (char_length(internal_notes) <= 2000),
  ADD COLUMN IF NOT EXISTS report_token TEXT UNIQUE;
