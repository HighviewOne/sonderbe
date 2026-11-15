-- 004: Homeowner information, household, multiple professionals, brokerages, images
-- Run in the Supabase SQL Editor after 003_directory_and_tracker.sql.
--
-- Decided 2026-11-15:
-- - Homeowners enter their information once (address, extra emails/phone, household,
--   hardship) and SonderBe reuses it: document lists are built from the household, the
--   hardship letter is drafted from it, and the chosen professional sees it.
-- - Household income is recorded as WHO earns and WHAT KIND of income. No dollar amounts.
-- - A homeowner can have one SonderBe case per category: real estate (agent, broker,
--   negotiator) and legal (legal professional). Attorneys stay direct-contact only, pending
--   attorney review: the homeowner records their lawyer in team_contacts and SonderBe
--   never sends the lawyer anything.
-- - A broker owns a brokerage and pays for it; invited agents are covered by the broker's
--   subscription.

-- ---------------------------------------------------------------------------
-- Homeowner information (one row per homeowner)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homeowner_info (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  property_street TEXT,
  property_unit TEXT,
  property_city TEXT,
  property_zip TEXT,
  property_county TEXT CHECK (property_county IS NULL OR property_county IN
    ('Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura')),
  mailing_same BOOLEAN NOT NULL DEFAULT TRUE,
  mailing_street TEXT,
  mailing_unit TEXT,
  mailing_city TEXT,
  mailing_state TEXT,
  mailing_zip TEXT,
  alt_phone TEXT,
  preferred_contact TEXT CHECK (preferred_contact IN ('phone', 'text', 'email')),
  best_time TEXT,
  servicer_name TEXT,
  hardship_reasons TEXT[] NOT NULL DEFAULT '{}',
  hardship_details TEXT CHECK (char_length(hardship_details) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extra emails (the login email in profiles.email is the main one)
CREATE TABLE IF NOT EXISTS homeowner_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (char_length(email) <= 254),
  label TEXT CHECK (label IN ('personal', 'work', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_homeowner_emails_unique ON homeowner_emails (user_id, lower(email));

-- Everyone living in the home, including the homeowner (is_self)
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_self BOOLEAN NOT NULL DEFAULT FALSE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 100),
  relationship TEXT NOT NULL DEFAULT 'other' CHECK (relationship IN
    ('self', 'spouse', 'partner', 'child', 'parent', 'relative', 'roommate', 'other')),
  on_mortgage BOOLEAN NOT NULL DEFAULT FALSE,
  -- employment, self_employment, social_security, pension, disability, unemployment,
  -- rental, child_support, other (validated by the backend)
  income_types TEXT[] NOT NULL DEFAULT '{}',
  employer TEXT CHECK (char_length(employer) <= 120),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members (user_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_one_self ON household_members (user_id) WHERE is_self;

-- ---------------------------------------------------------------------------
-- Multiple professionals: one SonderBe case per category
-- ---------------------------------------------------------------------------
ALTER TABLE match_requests
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'real_estate'
    CHECK (category IN ('real_estate', 'legal'));
ALTER TABLE match_requests DROP CONSTRAINT IF EXISTS match_requests_homeowner_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_requests_homeowner_category ON match_requests (homeowner_id, category);

-- Professionals the homeowner works with outside SonderBe matching (their lawyer).
-- SonderBe stores this for the homeowner's own tracking and never contacts them.
CREATE TABLE IF NOT EXISTS team_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('attorney', 'other')),
  directory_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  firm TEXT CHECK (char_length(firm) <= 120),
  phone TEXT CHECK (char_length(phone) <= 30),
  email TEXT CHECK (char_length(email) <= 254),
  status TEXT NOT NULL DEFAULT 'contacted' CHECK (status IN ('contacted', 'consultation', 'retained', 'done')),
  notes TEXT CHECK (char_length(notes) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_contacts_user ON team_contacts (user_id);

-- Documents: what kind (for the example viewer) and whose (household member)
ALTER TABLE case_documents
  ADD COLUMN IF NOT EXISTS doc_type TEXT,
  ADD COLUMN IF NOT EXISTS household_member_id UUID REFERENCES household_members(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Brokerages and images
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brokerages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  website TEXT,
  dre_number TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS brokerage_id UUID REFERENCES brokerages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_brokerage ON profiles (brokerage_id);

-- Invite links the broker sends to their agents (token generated by the backend)
CREATE TABLE IF NOT EXISTS brokerage_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id UUID NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_brokerage_invites_brokerage ON brokerage_invites (brokerage_id);

-- Public bucket for profile pictures and brokerage logos (uploads go through the backend)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-images', 'profile-images', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- updated_at triggers + RLS (backend-only access, as in 002/003)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_homeowner_info_updated_at ON homeowner_info;
CREATE TRIGGER update_homeowner_info_updated_at BEFORE UPDATE ON homeowner_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_household_members_updated_at ON household_members;
CREATE TRIGGER update_household_members_updated_at BEFORE UPDATE ON household_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_team_contacts_updated_at ON team_contacts;
CREATE TRIGGER update_team_contacts_updated_at BEFORE UPDATE ON team_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_brokerages_updated_at ON brokerages;
CREATE TRIGGER update_brokerages_updated_at BEFORE UPDATE ON brokerages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE homeowner_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowner_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerages ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_invites ENABLE ROW LEVEL SECURITY;
