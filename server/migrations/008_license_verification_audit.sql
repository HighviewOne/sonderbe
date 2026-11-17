-- 008: Who verified a professional's license and when, plus a history of every check.
-- profiles.license_verified_at / license_verified_by hold the current verification;
-- license_checks keeps every action (verified, removed by staff, cleared because the
-- professional changed their number or type), so a removal or change is never lost.
-- Run in the Supabase SQL Editor after 007_brokerage_departure.sql.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS license_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS license_verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS license_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  license_number TEXT,
  professional_type TEXT,
  action TEXT NOT NULL CHECK (action IN ('verified', 'removed', 'cleared')),
  -- The staff member; null for 'cleared' (the professional's own change) or a deleted admin
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_checks_professional_idx ON license_checks (professional_id, created_at DESC);

-- RLS on with no policies: only the backend (service role) can read/write
ALTER TABLE license_checks ENABLE ROW LEVEL SECURITY;

-- Staff mark a license verified (or remove it) and the history row is written in the same
-- transaction. Only applies if the number on file is still the one staff looked up;
-- returns false otherwise.
CREATE OR REPLACE FUNCTION set_license_verification(
  p_professional UUID, p_license_number TEXT, p_verified BOOLEAN, p_admin UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_type TEXT;
BEGIN
  UPDATE profiles
     SET license_verified = p_verified,
         license_verified_at = CASE WHEN p_verified THEN now() END,
         license_verified_by = CASE WHEN p_verified THEN p_admin END
   WHERE id = p_professional AND license_number = p_license_number
  RETURNING professional_type INTO v_type;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  INSERT INTO license_checks (professional_id, license_number, professional_type, action, admin_id)
  VALUES (p_professional, p_license_number, v_type, CASE WHEN p_verified THEN 'verified' ELSE 'removed' END, p_admin);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
REVOKE EXECUTE ON FUNCTION set_license_verification(UUID, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;

-- A verified license whose number or professional type changes is no longer verified,
-- whichever code path makes the change; the history records what was cleared.
CREATE OR REPLACE FUNCTION clear_license_verification_on_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.license_verified THEN
    INSERT INTO license_checks (professional_id, license_number, professional_type, action)
    VALUES (OLD.id, OLD.license_number, OLD.professional_type, 'cleared');
    NEW.license_verified := FALSE;
    NEW.license_verified_at := NULL;
    NEW.license_verified_by := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_license_change ON profiles;
CREATE TRIGGER profiles_license_change
  BEFORE UPDATE OF license_number, professional_type ON profiles
  FOR EACH ROW
  WHEN (OLD.license_number IS DISTINCT FROM NEW.license_number
        OR OLD.professional_type IS DISTINCT FROM NEW.professional_type)
  EXECUTE FUNCTION clear_license_verification_on_change();
