-- 002: Homeowner ↔ professional matching
-- Run in the Supabase SQL Editor after supabase/schema.sql and 001_investor_portal.sql.
--
-- Model: a homeowner (role 'client') opts in to be contacted by ONE professional in
-- their county. Subscribed professionals (role 'investor' in the DB — shown as
-- "Professional" in the UI) see open requests in their service counties with only a
-- readiness summary; contact details are revealed only after they claim the request.
-- No documents are stored — professionals collect them directly from the homeowner.

-- Counties a professional serves (empty = sees nothing until they set it)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS service_counties TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS match_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  county TEXT NOT NULL CHECK (county IN ('Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura')),
  situation TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  best_time TEXT,
  -- Exact consent wording the homeowner agreed to, and when (keep for compliance)
  consent_text TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'closed', 'withdrawn')),
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_requests_county_status ON match_requests (county, status);
CREATE INDEX IF NOT EXISTS idx_match_requests_claimed_by ON match_requests (claimed_by);

DROP TRIGGER IF EXISTS update_match_requests_updated_at ON match_requests;
CREATE TRIGGER update_match_requests_updated_at
  BEFORE UPDATE ON match_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS on with no policies: only the backend (service role) can read/write this table
ALTER TABLE match_requests ENABLE ROW LEVEL SECURITY;

-- 001 created its tables without RLS, which left them readable/writable through the
-- public anon key. The backend uses the service role (bypasses RLS), so turning RLS
-- on with no policies closes that without affecting the app.
ALTER TABLE investor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE distressed_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_uploads ENABLE ROW LEVEL SECURITY;
