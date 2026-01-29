-- Investor Portal Migration
-- Run this in your Supabase SQL Editor

-- 1. Extend profiles role constraint to include 'investor'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client', 'admin', 'investor'));

-- 2. Create investor_subscriptions table
CREATE TABLE IF NOT EXISTS investor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive'
    CHECK (status IN ('active', 'past_due', 'canceled', 'inactive', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  plan_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create distressed_properties table
CREATE TABLE IF NOT EXISTS distressed_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_type TEXT NOT NULL CHECK (lead_type IN ('foreclosure_nod', 'foreclosure_not', 'probate', 'tax_lien', 'tax_sale')),
  county TEXT NOT NULL CHECK (county IN ('Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura')),
  property_address TEXT,
  city TEXT,
  zip TEXT,
  apn TEXT,
  owner_name TEXT,
  owner_mailing_address TEXT,
  estimated_value NUMERIC,
  outstanding_debt NUMERIC,
  estimated_equity NUMERIC,
  opening_bid NUMERIC,
  recording_date DATE,
  document_number TEXT,
  case_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'redeemed', 'expired', 'removed')),
  sale_date DATE,
  notes TEXT,
  source TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for distressed_properties
CREATE INDEX IF NOT EXISTS idx_properties_county ON distressed_properties(county);
CREATE INDEX IF NOT EXISTS idx_properties_lead_type ON distressed_properties(lead_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON distressed_properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_zip ON distressed_properties(zip);
CREATE INDEX IF NOT EXISTS idx_properties_city ON distressed_properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_recording_date ON distressed_properties(recording_date);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON distressed_properties(created_at);

-- 5. Create csv_uploads audit table
CREATE TABLE IF NOT EXISTS csv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES profiles(id),
  file_name TEXT,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('foreclosure_nod', 'foreclosure_not', 'probate', 'tax_lien', 'tax_sale')),
  county TEXT NOT NULL CHECK (county IN ('Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura')),
  row_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create index on investor_subscriptions
CREATE INDEX IF NOT EXISTS idx_investor_subs_user ON investor_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_subs_status ON investor_subscriptions(status);
