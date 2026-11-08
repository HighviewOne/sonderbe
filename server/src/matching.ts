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
