-- 007: An agent who leaves (or is removed from) a brokerage gets the same 14-day read-only
-- period as a professional whose own subscription ended, instead of losing their clients at once.
-- Run in the Supabase SQL Editor after 006_subscription_lapse_and_ad_admin.sql.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS left_brokerage_at TIMESTAMPTZ;
