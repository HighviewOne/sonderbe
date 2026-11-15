// Shared constants for homeowner ↔ professional matching.
// COUNTIES and SITUATIONS must match the frontend lists in src/lib/constants.ts.

export const COUNTIES = ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura']

export const SITUATIONS = ['behind', 'notice', 'sale', 'struggling', 'other']

// Most open claims one professional can hold at once, so nobody hoards leads
export const MAX_ACTIVE_CLAIMS = 10

// The wording a homeowner agrees to. It is stored with each request, so changing it
// here only affects new requests. Have an attorney review before launch.
export const CONSENT_TEXT =
  'I agree that SonderBe may share my name, email, phone number (if given), county, ' +
  'situation, and checklist progress with one real estate professional who serves my ' +
  'county, and that this professional may contact me by phone, text, or email about my ' +
  'situation. I understand that SonderBe does not charge homeowners, that I never have ' +
  'to pay anyone upfront for foreclosure help, that agreeing is not required to use ' +
  'SonderBe, and that I can withdraw at any time from my portal.'

// ---------------------------------------------------------------------------
// Directory + case tracker (migration 003). Keep in sync with src/lib/constants.ts.
// ---------------------------------------------------------------------------

export const PROFESSIONAL_TYPES = ['agent', 'broker', 'attorney', 'legal_professional', 'negotiator'] as const
export type ProfessionalType = typeof PROFESSIONAL_TYPES[number]

// Types whose license SonderBe can verify (DRE / State Bar); the rest show "Not a state-licensed profession"
export const LICENSED_TYPES: readonly ProfessionalType[] = ['agent', 'broker', 'attorney']

// Pending attorney review (Jackson v. LegalMatch, B&P §6155): these types are listed
// as plain directory ads — the homeowner contacts them directly; SonderBe never sends
// the homeowner's details to them and they get no case tracker.
export const DIRECT_CONTACT_ONLY_TYPES: readonly ProfessionalType[] = ['attorney']

export const STAGES = [
  'matched', 'first_contact', 'documents_requested', 'documents_received',
  'submitted_to_lender', 'lender_review', 'outcome'
] as const
export type Stage = typeof STAGES[number]

export const OUTCOMES = ['short_sale_closed', 'loan_modified', 'reinstated', 'sold', 'foreclosed', 'other'] as const

// Consent when the homeowner picks a specific professional from the directory.
// The chosen professional's name is appended when the request is stored.
export const CHOSEN_CONSENT_TEXT =
  'I agree that SonderBe may share my name, email, phone number (if given), county, ' +
  'situation, and checklist progress with the one professional I chose, and that this ' +
  'professional may contact me by phone, text, or email about my situation and post ' +
  'updates and document requests to my portal. I understand that SonderBe does not charge ' +
  'homeowners, that I never have to pay anyone upfront for foreclosure help, that SonderBe ' +
  'does not recommend or guarantee any professional, and that I can withdraw at any time ' +
  'from my portal.'

export const STANDARD_DOCUMENTS = [
  'Last 2 months of bank statements (all accounts)',
  'Last 2 years of tax returns',
  'Last 30 days of pay stubs',
  'Hardship letter (why you fell behind)',
  'Most recent mortgage statement'
]
