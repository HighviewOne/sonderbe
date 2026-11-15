-- 005: Professional contact info, repeat document requests, notes
-- Run in the Supabase SQL Editor after 004_homeowner_info_teams_brokerages.sql.
--
-- Decided 2026-11-15:
-- - Professionals have their own "My Information" (office address, phones, fax, where clients
--   send documents). Clients they work with see it on their case.
-- - Documents can be requested again: a fresh copy (e.g. this month's bank statement for a loan
--   modification) or a fix (e.g. page 3 missing). Each request is a new "round"; the history keeps
--   every round. A document can carry a refresh period (e.g. 30 days) after which it shows as
--   "due for an update" on the professional's checklist across all clients.
-- - Notes: a thread per case, optionally tied to one document, between the homeowner and the
--   professional. Unread counts use a last-read time per side.

-- ---------------------------------------------------------------------------
-- Professional contact information (one row per professional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professional_info (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  office_street TEXT,
  office_unit TEXT,
  office_city TEXT,
  office_state TEXT,
  office_zip TEXT,
  office_phone TEXT,
  fax TEXT,
  document_email TEXT,
  document_instructions TEXT CHECK (char_length(document_instructions) <= 1000),
  office_hours TEXT CHECK (char_length(office_hours) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Document rounds
-- ---------------------------------------------------------------------------
ALTER TABLE case_documents
  ADD COLUMN IF NOT EXISTS round INTEGER NOT NULL DEFAULT 1,
  -- Days a received copy stays current (NULL = never expires)
  ADD COLUMN IF NOT EXISTS refresh_days INTEGER CHECK (refresh_days IS NULL OR refresh_days BETWEEN 1 AND 730),
  -- Why the latest round was requested ("Need the October statement", "Page 3 is missing")
  ADD COLUMN IF NOT EXISTS request_reason TEXT CHECK (char_length(request_reason) <= 300),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  -- When the previous round was received (kept so the professional can see the last good copy date)
  ADD COLUMN IF NOT EXISTS last_received_at TIMESTAMPTZ;

-- Every action on a document, every round
CREATE TABLE IF NOT EXISTS case_document_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES case_documents(id) ON DELETE CASCADE,
  match_request_id UUID NOT NULL REFERENCES match_requests(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('requested', 'sent', 'unsent', 'received', 'unreceived', 'requested_again')),
  reason TEXT CHECK (char_length(reason) <= 300),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_document_history_doc ON case_document_history (document_id, created_at);

-- ---------------------------------------------------------------------------
-- Notes between homeowner and professional
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_request_id UUID NOT NULL REFERENCES match_requests(id) ON DELETE CASCADE,
  -- NULL = about the case in general
  document_id UUID REFERENCES case_documents(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('homeowner', 'professional')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_notes_request ON case_notes (match_request_id, created_at);

ALTER TABLE match_requests
  ADD COLUMN IF NOT EXISTS homeowner_notes_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS professional_notes_read_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Triggers + RLS (backend-only access)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_professional_info_updated_at ON professional_info;
CREATE TRIGGER update_professional_info_updated_at BEFORE UPDATE ON professional_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE professional_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_document_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
