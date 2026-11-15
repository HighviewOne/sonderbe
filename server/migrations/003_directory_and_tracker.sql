-- 003: Professional directory, case tracker, document checklist, service ads
-- Run in the Supabase SQL Editor after 002_agent_matching.sql.
--
-- Model (decided 2026-11-15): the homeowner browses professionals in their county and
-- picks one. The match request is then created already assigned to that professional
-- (status 'claimed', claimed_by = the chosen professional). The professional moves the
-- case through stages and keeps a document list; the homeowner marks each document
-- "sent" and the professional marks it "received". Files never pass through SonderBe.
-- Service businesses (movers, storage...) buy flat per-county ad slots, shown on a
-- separate "Moving forward" page. Advertisers never receive homeowner data.

-- ---------------------------------------------------------------------------
-- Professional profile fields (role 'investor' = subscribed professional)
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS professional_type TEXT
    CHECK (professional_type IN ('agent', 'broker', 'attorney', 'legal_professional', 'negotiator')),
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  -- Set by an admin after checking DRE / State Bar records; never by the professional
  ADD COLUMN IF NOT EXISTS license_verified BOOLEAN NOT NULL DEFAULT FALSE,
  -- When the professional agreed to charge homeowners no upfront fees
  ADD COLUMN IF NOT EXISTS no_upfront_fee_pledged_at TIMESTAMPTZ,
  -- Shown in the homeowner directory only when true
  ADD COLUMN IF NOT EXISTS listed BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Case stage on each match request
-- ---------------------------------------------------------------------------
ALTER TABLE match_requests
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'matched'
    CHECK (stage IN ('matched', 'first_contact', 'documents_requested', 'documents_received',
                     'submitted_to_lender', 'lender_review', 'outcome')),
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT
    CHECK (outcome IN ('short_sale_closed', 'loan_modified', 'reinstated', 'sold', 'foreclosed', 'other')),
  ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMPTZ;

-- Timeline: one row per stage change or note the professional posts
CREATE TABLE IF NOT EXISTS case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_request_id UUID NOT NULL REFERENCES match_requests(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_events_request ON case_events (match_request_id, created_at);

-- Document checklist: the professional writes the items, the homeowner marks them sent
CREATE TABLE IF NOT EXISTS case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_request_id UUID NOT NULL REFERENCES match_requests(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
  sort_order INTEGER NOT NULL DEFAULT 0,
  homeowner_note TEXT CHECK (char_length(homeowner_note) <= 300),
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_documents_request ON case_documents (match_request_id, sort_order);

DROP TRIGGER IF EXISTS update_case_documents_updated_at ON case_documents;
CREATE TRIGGER update_case_documents_updated_at
  BEFORE UPDATE ON case_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Service ads (movers, storage, ...): managed by admins, flat per-county slots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('movers', 'storage', 'cleaning', 'rental_housing', 'other')),
  headline TEXT NOT NULL CHECK (char_length(headline) <= 120),
  description TEXT CHECK (char_length(description) <= 500),
  phone TEXT,
  website TEXT,
  -- e.g. 'Cal-T' for movers; required for movers before the ad can be active
  license_label TEXT,
  license_number TEXT,
  counties TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_on DATE,
  ends_on DATE,
  view_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT movers_need_permit CHECK (category <> 'movers' OR NOT active OR license_number IS NOT NULL)
);

DROP TRIGGER IF EXISTS update_service_ads_updated_at ON service_ads;
CREATE TRIGGER update_service_ads_updated_at
  BEFORE UPDATE ON service_ads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Atomic counters for ad views/clicks (called by the backend)
CREATE OR REPLACE FUNCTION increment_ad_counter(ad_id UUID, counter TEXT)
RETURNS VOID AS $$
BEGIN
  IF counter = 'view' THEN
    UPDATE service_ads SET view_count = view_count + 1 WHERE id = ad_id;
  ELSIF counter = 'click' THEN
    UPDATE service_ads SET click_count = click_count + 1 WHERE id = ad_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
REVOKE EXECUTE ON FUNCTION increment_ad_counter(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- RLS on with no policies: only the backend (service role) can read/write
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_ads ENABLE ROW LEVEL SECURITY;
