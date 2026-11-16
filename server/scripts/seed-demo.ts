// Seed the TEST Supabase project with demo accounts, cases and service ads.
//
//   npm run seed:demo            (from server/)
//
// Reads server/.env.test.local only. Refuses to run against the live project.
// Safe to re-run: every @example.com account (and everything tied to it) and every
// service ad is deleted first, then recreated.

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CHOSEN_CONSENT_TEXT } from '../src/matching.js'
import { randomBytes } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const testEnv = dotenv.parse(readFileSync(join(here, '..', '.env.test.local')))
const LIVE_PROJECT_REF = 'gfeeiyjhjapysiqxwiqi'

const url = testEnv.SUPABASE_URL
const key = testEnv.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('server/.env.test.local needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
if (url.includes(LIVE_PROJECT_REF)) throw new Error('Refusing to seed the LIVE project')

const db = createClient(url, key, { auth: { persistSession: false } })

export const DEMO_PASSWORD = 'SonderDemo-2026'
const DEMO_DOMAIN = '@example.com'

function must<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error) throw new Error(`${what}: ${JSON.stringify(result.error)}`)
  return result.data as T
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
async function reset() {
  let page = 1
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const demo = data.users.filter(u => u.email?.endsWith(DEMO_DOMAIN))
    for (const u of demo) {
      // match_requests.claimed_by is ON DELETE SET NULL, homeowner_id cascades
      must(await db.auth.admin.deleteUser(u.id), `delete ${u.email}`)
    }
    if (data.users.length < 200) break
    if (demo.length === 0) page++
  }
  must(await db.from('service_ads').delete().not('id', 'is', null), 'clear service_ads')
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
async function createUser(email: string, fullName: string, phone: string | null) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone }
  })
  if (error || !data.user) throw new Error(`create ${email}: ${JSON.stringify(error)}`)
  return data.user.id // the handle_new_user trigger creates the profile row
}

interface ProSeed {
  key: string
  ownSubscription?: boolean
  // Demo the lapse states: 'grace' = payment failing for 3 days, 'read_only' = ended 2 days ago
  lapse?: 'grace' | 'read_only'
  email: string
  full_name: string
  phone: string
  professional_type: 'agent' | 'broker' | 'attorney' | 'legal_professional' | 'negotiator'
  business_name: string
  bio: string
  website: string | null
  license_number: string | null
  license_verified: boolean
  service_counties: string[]
}

const PROS: ProSeed[] = [
  {
    key: 'agent',
    email: 'pro.agent@example.com', full_name: 'Maria Lopez', phone: '(213) 555-0141',
    professional_type: 'agent', business_name: 'Lopez Short Sale Realty',
    bio: 'Short-sale listing agent for 12 years. I work with your lender so the sale closes before the auction date. Paid only from the sale at closing.',
    website: 'https://example.com/lopez', license_number: 'DEMO-DRE-01234567', license_verified: true,
    service_counties: ['Los Angeles', 'Orange']
  },
  {
    key: 'broker',
    email: 'pro.broker@example.com', full_name: 'David Chen', phone: '(562) 555-0187',
    professional_type: 'broker', business_name: 'Harbor Brokerage Group',
    bio: 'Broker with a team of four short-sale agents. Bilingual English/Mandarin.',
    website: 'https://example.com/harbor', license_number: 'DEMO-DRE-07654321', license_verified: true,
    service_counties: ['Los Angeles', 'Orange', 'Riverside']
  },
  {
    key: 'attorney',
    email: 'pro.attorney@example.com', full_name: 'Sarah Kim', phone: '(310) 555-0112',
    professional_type: 'attorney', business_name: 'Kim Homeowner Defense Law',
    bio: 'Foreclosure defense and bankruptcy attorney. Free first consultation.',
    website: 'https://example.com/kimlaw', license_number: 'DEMO-SBN-298765', license_verified: true,
    service_counties: ['Los Angeles']
  },
  {
    key: 'legal',
    email: 'pro.legal@example.com', full_name: 'James Carter', phone: '(951) 555-0166',
    professional_type: 'legal_professional', business_name: 'Carter Document Services',
    bio: 'Registered legal document assistant. I help prepare paperwork; I do not give legal advice.',
    website: null, license_number: 'DEMO-LDA-4411', license_verified: false,
    service_counties: ['Los Angeles', 'Riverside']
  },
  {
    key: 'negotiator',
    email: 'pro.negotiator@example.com', full_name: 'Tony Reyes', phone: '(818) 555-0199',
    professional_type: 'negotiator', business_name: 'Reyes Lender Negotiation',
    bio: 'I negotiate with lenders on short-sale approvals for listing agents and homeowners.',
    website: null, license_number: null, license_verified: false,
    service_counties: ['Los Angeles']
  },
  {
    key: 'harbor_agent', ownSubscription: false,
    email: 'pro.harbor@example.com', full_name: 'Priya Shah', phone: '(562) 555-0190',
    professional_type: 'agent', business_name: 'Harbor Brokerage Group',
    bio: 'Short-sale specialist on the Harbor team. Hablo español.',
    website: null, license_number: 'DEMO-DRE-02223333', license_verified: true,
    service_counties: ['Los Angeles', 'Orange']
  },
  {
    key: 'grace', lapse: 'grace',
    email: 'pro.grace@example.com', full_name: 'Gina Torres', phone: '(805) 555-0131',
    professional_type: 'agent', business_name: 'Torres Home Solutions',
    bio: 'Ventura County agent helping families sell before the trustee sale. Evening and weekend calls are fine.',
    website: null, license_number: 'DEMO-DRE-04445555', license_verified: true,
    service_counties: ['Ventura', 'Los Angeles']
  },
  {
    key: 'lapsed', lapse: 'read_only',
    email: 'pro.lapsed@example.com', full_name: 'Leo Park', phone: '(909) 555-0177',
    professional_type: 'agent', business_name: 'Park Realty Partners',
    bio: 'Inland Empire short-sale agent. Se habla español.',
    website: null, license_number: 'DEMO-DRE-06667777', license_verified: true,
    service_counties: ['San Bernardino', 'Los Angeles']
  }
]

async function seedPros() {
  const ids: Record<string, string> = {}
  for (const p of PROS) {
    const id = await createUser(p.email, p.full_name, p.phone)
    must(await db.from('profiles').update({
      role: 'investor',
      professional_type: p.professional_type,
      business_name: p.business_name,
      bio: p.bio,
      website: p.website,
      license_number: p.license_number,
      license_verified: p.license_verified,
      no_upfront_fee_pledged_at: daysAgo(30),
      listed: true,
      service_counties: p.service_counties
    }).eq('id', id), `profile ${p.email}`)
    if (p.ownSubscription !== false) {
      must(await db.from('investor_subscriptions').insert({
        user_id: id,
        stripe_customer_id: `cus_demo_${p.key}`,
        status: p.lapse === 'grace' ? 'past_due' : p.lapse === 'read_only' ? 'canceled' : 'active',
        past_due_since: p.lapse === 'grace' ? daysAgo(3) : null,
        ended_at: p.lapse === 'read_only' ? daysAgo(2) : null,
        current_period_start: daysAgo(10),
        // An ended subscription's period ends when it ended (admin shows this date)
        current_period_end: p.lapse === 'read_only' ? daysAgo(2) : daysAgo(-20)
      }), `subscription ${p.email}`)
    }
    ids[p.key] = id
  }

  must(await db.from('professional_info').insert({
    user_id: ids.agent, office_street: '500 Example Blvd', office_unit: 'Suite 210', office_city: 'Pasadena', office_state: 'CA',
    office_zip: '91101', office_phone: '(626) 555-0150', fax: '(626) 555-0151', document_email: 'docs.lopez@example.com',
    document_instructions: 'Email PDFs with your last name in the subject line. Phone photos are fine if every corner is visible.',
    office_hours: 'Mon–Fri 9–6, Sat by appointment'
  }), 'professional info')

  // David (broker) runs Harbor Brokerage Group; Priya is on his team, covered by his subscription
  const brokerage = must(await db.from('brokerages').insert({
    owner_id: ids.broker, name: 'Harbor Brokerage Group', website: 'https://example.com/harbor', dre_number: 'DEMO-CORP-0099'
  }).select('id').single(), 'brokerage')
  must(await db.from('profiles').update({ brokerage_id: brokerage.id }).in('id', [ids.broker, ids.harbor_agent]), 'brokerage members')
  must(await db.from('brokerage_invites').insert({
    brokerage_id: brokerage.id, email: 'new.agent@example.com', token: randomBytes(24).toString('base64url')
  }), 'brokerage invite')
  return ids
}

// ---------------------------------------------------------------------------
// Homeowners and their cases
// ---------------------------------------------------------------------------
type Stage = 'matched' | 'first_contact' | 'documents_requested' | 'documents_received' |
  'submitted_to_lender' | 'lender_review' | 'outcome'

interface CaseSeed {
  pro: string
  category?: 'real_estate' | 'legal'
  situation: string
  stage: Stage
  next_step: string
  events: { stage: Stage; note: string; days: number }[]
  documents?: { label: string; type?: string; sent?: number; received?: number; note?: string; round?: number; reason?: string; lastReceived?: number }[]
  notes?: { by: 'homeowner' | 'professional'; body: string; days: number; doc?: number }[]
  notesReadByPro?: number
}

const REFRESH: Record<string, number | null> = {
  bank_statement: 30, pay_stub: 30, mortgage_statement: 30, profit_loss: 90, irs_4506c: 120, benefit_letter: 365
}

interface MemberSeed { full_name: string; relationship: string; on_mortgage?: boolean; income_types: string[]; employer?: string }

interface HomeownerSeed {
  email: string
  full_name: string
  phone: string
  checklist: [number, number][] // [category_index, item_index] already checked
  case?: CaseSeed
  legalCase?: CaseSeed
  info?: Record<string, unknown>
  selfIncome?: string[]
  selfEmployer?: string
  household?: MemberSeed[]
  emails?: { email: string; label: string }[]
  team?: Record<string, unknown>[]
}

const STANDARD_DOCS = [
  'Last 2 months of bank statements (all accounts)',
  'Last 2 years of tax returns',
  'Last 30 days of pay stubs',
  'Hardship letter (why you fell behind)',
  'Most recent mortgage statement'
]
const STANDARD_TYPES = ['bank_statement', 'tax_return', 'pay_stub', 'hardship_letter', 'mortgage_statement']

const HOMEOWNERS: HomeownerSeed[] = [
  {
    email: 'home.stranded@example.com', full_name: 'Sam Rivera', phone: '(909) 555-0105',
    checklist: [[0, 0]],
    info: { property_street: '12 Demo Ct', property_city: 'Fontana', property_zip: '92335', property_county: 'San Bernardino', mailing_same: true, hardship_reasons: ['job_loss'] },
    selfIncome: ['unemployment'],
    case: {
      pro: 'lapsed', situation: 'behind', stage: 'documents_requested',
      next_step: 'Send your unemployment benefit letter.',
      events: [
        { stage: 'matched', note: 'You chose Leo Park.', days: 20 },
        { stage: 'documents_requested', note: 'Sent the document list.', days: 15 }
      ],
      documents: [
        { label: 'Your unemployment benefit letter and payment history', type: 'benefit_letter' },
        { label: 'Most recent mortgage statement', type: 'mortgage_statement', sent: 14, received: 13 }
      ]
    }
  },
  {
    email: 'home.new@example.com', full_name: 'Linda Park', phone: '(213) 555-0101',
    checklist: [[0, 0], [0, 1]]
  },
  {
    email: 'home.matched@example.com', full_name: 'Robert Diaz', phone: '(323) 555-0102',
    checklist: [[0, 0], [0, 1], [1, 0]],
    case: {
      pro: 'agent', situation: 'notice', stage: 'first_contact',
      next_step: 'Maria will call Thursday afternoon to walk through your options.',
      events: [
        { stage: 'matched', note: 'You chose Maria Lopez.', days: 3 },
        { stage: 'first_contact', note: 'Left a voicemail and sent an intro email.', days: 1 }
      ],
      documents: [
        { label: 'Most recent mortgage statement', type: 'mortgage_statement', sent: 0 },
        { label: 'Last 2 months of bank statements (all accounts)', type: 'bank_statement' }
      ],
      notes: [{ by: 'homeowner', body: 'Is it OK to send the mortgage statement as a phone photo?', days: 0, doc: 0 }]
    }
  },
  {
    email: 'home.docs@example.com', full_name: 'Angela Brooks', phone: '(626) 555-0103',
    checklist: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]],
    info: {
      property_street: '4180 Example Ave', property_city: 'Pasadena', property_zip: '91101', property_county: 'Los Angeles',
      mailing_same: true, preferred_contact: 'text', best_time: 'After 5pm', servicer_name: 'Example Home Loan Servicing',
      hardship_reasons: ['reduced_income', 'medical'],
      hardship_details: 'In March my hours were cut from 40 to 24 a week, and my husband had surgery in May. We fell three payments behind.'
    },
    selfIncome: ['employment'], selfEmployer: 'Acme Logistics',
    household: [
      { full_name: 'Marcus Brooks', relationship: 'spouse', on_mortgage: true, income_types: ['disability'] },
      { full_name: 'Jalen Brooks', relationship: 'child', income_types: ['employment'], employer: 'Fresh Market' }
    ],
    emails: [{ email: 'angela.work@example.com', label: 'work' }],
    case: {
      pro: 'agent', situation: 'behind', stage: 'documents_requested',
      next_step: 'Send the remaining documents by email so I can open the short-sale file with your lender.',
      events: [
        { stage: 'matched', note: 'You chose Maria Lopez.', days: 9 },
        { stage: 'first_contact', note: 'Phone call: agreed to list the home as a short sale.', days: 8 },
        { stage: 'documents_requested', note: 'Sent the document list.', days: 6 }
      ],
      documents: [
        { label: STANDARD_DOCS[0], type: 'bank_statement', sent: 41, received: 40 },
        { label: STANDARD_DOCS[1], type: 'tax_return', round: 2, reason: 'The 2024 return is missing Schedule 1.', lastReceived: 3, sent: 1, note: 'Re-sent 2024 with all schedules' },
        { label: STANDARD_DOCS[2], type: 'pay_stub' },
        { label: STANDARD_DOCS[3], type: 'hardship_letter' },
        { label: STANDARD_DOCS[4], type: 'mortgage_statement', sent: 5, received: 5 }
      ],
      notes: [
        { by: 'professional', body: 'Does the Golden Coast statement cover your savings account too?', days: 2, doc: 0 },
        { by: 'homeowner', body: 'Savings is at a different bank. I can send that one too.', days: 1, doc: 0 },
        { by: 'homeowner', body: 'Marcus has a doctor visit Thursday, can we talk Friday instead?', days: 0 }
      ],
      notesReadByPro: 2
    }
  },
  {
    email: 'home.lender@example.com', full_name: 'Michael Nguyen', phone: '(714) 555-0104',
    checklist: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [2, 0]],
    case: {
      pro: 'broker', situation: 'sale', stage: 'lender_review',
      next_step: 'The lender ordered an appraisal. Expect a call to schedule access to the home.',
      events: [
        { stage: 'matched', note: 'You chose David Chen.', days: 40 },
        { stage: 'first_contact', note: 'Met at the property.', days: 38 },
        { stage: 'documents_requested', note: 'Sent the document list.', days: 37 },
        { stage: 'documents_received', note: 'All documents received. Thank you!', days: 30 },
        { stage: 'submitted_to_lender', note: 'Short-sale package submitted with a $612,000 offer.', days: 21 },
        { stage: 'lender_review', note: 'Lender assigned a negotiator and ordered an appraisal.', days: 4 }
      ],
      documents: STANDARD_DOCS.map((label, i) => ({ label, type: STANDARD_TYPES[i], sent: 36 - i, received: 31 }))
    },
    legalCase: {
      pro: 'legal', category: 'legal', situation: 'sale', stage: 'documents_requested',
      next_step: 'James is preparing your declaration for the court. Send the Notice of Sale.',
      events: [
        { stage: 'matched', note: 'You chose James Carter.', days: 12 },
        { stage: 'documents_requested', note: 'Requested the Notice of Sale and the loan papers.', days: 10 }
      ],
      documents: [{ label: 'Notice of Trustee Sale (all pages)', type: 'other' }]
    },
    info: {
      property_street: '77 Harbor View Dr', property_city: 'Long Beach', property_zip: '90802', property_county: 'Los Angeles',
      mailing_same: false, mailing_street: 'PO Box 1200', mailing_city: 'Long Beach', mailing_state: 'CA', mailing_zip: '90801',
      preferred_contact: 'phone', servicer_name: 'Sample Mortgage Co.', hardship_reasons: ['business_failure']
    },
    selfIncome: ['self_employment'],
    household: [{ full_name: 'Grace Nguyen', relationship: 'parent', income_types: ['social_security'] }],
    team: [{
      role: 'attorney', name: 'Sarah Kim', firm: 'Kim Homeowner Defense Law', phone: '(310) 555-0112',
      email: 'pro.attorney@example.com', status: 'retained', notes: 'Court hearing on the sale postponement: Dec 3.'
    }]
  }
]

async function seedHomeowners(proIds: Record<string, string>) {
  for (const h of HOMEOWNERS) {
    const id = await createUser(h.email, h.full_name, h.phone)

    if (h.checklist.length) {
      must(await db.from('checklist_progress').insert(h.checklist.map(([c, i]) => ({
        user_id: id, category_index: c, item_index: i, is_checked: true, checked_at: daysAgo(5)
      }))), `checklist ${h.email}`)
    }

    if (h.info) must(await db.from('homeowner_info').insert({ user_id: id, ...h.info }), `info ${h.email}`)
    must(await db.from('household_members').insert([
      { user_id: id, is_self: true, full_name: h.full_name, relationship: 'self', on_mortgage: true,
        income_types: h.selfIncome ?? [], employer: h.selfEmployer ?? null, sort_order: 0 },
      ...(h.household ?? []).map((m, i) => ({
        user_id: id, is_self: false, full_name: m.full_name, relationship: m.relationship, on_mortgage: m.on_mortgage ?? false,
        income_types: m.income_types, employer: m.employer ?? null, sort_order: i + 1
      }))
    ]), `household ${h.email}`)
    if (h.emails) must(await db.from('homeowner_emails').insert(h.emails.map(e => ({ user_id: id, ...e }))), `emails ${h.email}`)
    if (h.team) must(await db.from('team_contacts').insert(h.team.map(t => ({ user_id: id, ...t }))), `team ${h.email}`)

    for (const c of [h.case, h.legalCase]) {
      if (c) await seedCase(id, h, c, proIds)
    }
  }
}

async function seedCase(id: string, h: HomeownerSeed, c: CaseSeed, proIds: Record<string, string>) {
  const pro = PROS.find(p => p.key === c.pro)!
  const first = c.events[0].days
  const request = must(await db.from('match_requests').insert({
    homeowner_id: id,
    category: c.category ?? 'real_estate',
    county: (h.info?.property_county as string | undefined) ?? 'Los Angeles',
    situation: c.situation,
    contact_name: h.full_name,
    contact_email: h.email,
    contact_phone: h.phone,
    best_time: 'Weekday evenings',
    consent_text: `${CHOSEN_CONSENT_TEXT} Professional chosen: ${pro.full_name}, ${pro.business_name}.`,
    consented_at: daysAgo(first),
    status: 'claimed',
    claimed_by: proIds[c.pro],
    claimed_at: daysAgo(first),
    stage: c.stage,
    next_step: c.next_step,
    stage_updated_at: daysAgo(c.events[c.events.length - 1].days)
  }).select('id').single(), `match ${h.email}`)

  must(await db.from('case_events').insert(c.events.map(e => ({
    match_request_id: request.id, stage: e.stage, note: e.note,
    created_by: e.stage === 'matched' ? id : proIds[c.pro], created_at: daysAgo(e.days)
  }))), `events ${h.email}`)

  if (c.documents) {
    const docs = must(await db.from('case_documents').insert(c.documents.map((d, i) => ({
      match_request_id: request.id, label: d.label, sort_order: i, doc_type: d.type ?? 'other',
      homeowner_note: d.note ?? null,
      sent_at: d.sent !== undefined ? daysAgo(d.sent) : null,
      received_at: d.received !== undefined ? daysAgo(d.received) : null,
      refresh_days: REFRESH[d.type ?? 'other'] ?? null,
      round: d.round ?? 1,
      request_reason: d.reason ?? null,
      last_received_at: d.lastReceived !== undefined ? daysAgo(d.lastReceived) : null
    }))).select('id, sort_order'), `documents ${h.email}`).sort((a, b) => a.sort_order - b.sort_order)
    if (c.notes) {
      must(await db.from('case_notes').insert(c.notes.map(n => ({
        match_request_id: request.id,
        document_id: n.doc !== undefined ? docs[n.doc].id : null,
        author_id: n.by === 'homeowner' ? id : proIds[c.pro],
        author_role: n.by,
        body: n.body,
        created_at: daysAgo(n.days)
      }))), `notes ${h.email}`)
    }
    if (c.notesReadByPro !== undefined) {
      must(await db.from('match_requests').update({ professional_notes_read_at: daysAgo(c.notesReadByPro) }).eq('id', request.id), 'notes read')
    }
  }
}

// ---------------------------------------------------------------------------
// Admin + service ads
// ---------------------------------------------------------------------------
async function seedAdmin() {
  const id = await createUser('admin@example.com', 'Demo Admin', null)
  must(await db.from('profiles').update({ role: 'admin' }).eq('id', id), 'admin role')
}

async function seedAds() {
  must(await db.from('service_ads').insert([
    {
      contact_name: 'Ana Ruiz', contact_email: 'ana@example.com', monthly_price: 149, report_token: randomBytes(18).toString('base64url'),
      business_name: 'SoCal Gentle Movers', category: 'movers',
      headline: 'Local moves from $95/hour, 2-hour minimum',
      description: 'Licensed, insured household movers. Free in-home or video estimate.',
      phone: '(213) 555-0170', website: 'https://example.com/movers',
      license_label: 'Cal-T', license_number: 'DEMO-190000', counties: ['Los Angeles', 'Orange'], active: true
    },
    {
      contact_name: 'Ben Ito', contact_email: 'ben@example.com', monthly_price: 99, report_token: randomBytes(18).toString('base64url'),
      business_name: 'StoreSafe Self Storage', category: 'storage',
      headline: 'First month $1 on 10x10 units',
      description: 'Climate-controlled units, month-to-month, no long-term contract.',
      phone: '(323) 555-0171', website: 'https://example.com/storage',
      counties: ['Los Angeles'], active: true
    },
    {
      business_name: 'Fresh Start Cleaning', category: 'cleaning',
      headline: 'Move-out cleaning, flat rate by home size',
      description: 'Get the home ready for showings or hand-over.',
      phone: '(818) 555-0172', website: null,
      counties: ['Los Angeles', 'Ventura'], active: true
    },
    {
      business_name: 'Valley Rentals Network', category: 'rental_housing',
      headline: 'Rentals that work with past foreclosures',
      description: 'Landlords who look at income and references, not just credit score.',
      phone: '(626) 555-0173', website: 'https://example.com/rentals',
      counties: ['Los Angeles'], active: true
    },
    {
      business_name: 'Budget Truck Movers', category: 'movers',
      headline: 'Inactive demo ad (no Cal-T number yet)',
      description: 'Should never appear to homeowners.',
      phone: null, website: null, counties: ['Los Angeles'], active: false
    }
  ]), 'service ads')
}

async function main() {
  console.log(`Seeding TEST project ${new URL(url).host}`)
  await reset()
  const proIds = await seedPros()
  await seedHomeowners(proIds)
  await seedAdmin()
  await seedAds()

  console.log(`\nDemo logins (password for all: ${DEMO_PASSWORD})`)
  console.log('  Homeowners: home.new / home.matched / home.docs / home.lender @example.com')
  console.log('  Professionals: pro.agent / pro.broker / pro.attorney / pro.legal / pro.negotiator / pro.harbor @example.com')
  console.log('  Brokerage: pro.broker runs Harbor Brokerage Group; pro.harbor is on the team')
  console.log('  Lapsed: pro.grace (payment failing, grace), pro.lapsed (ended, read-only; client home.stranded)')
  console.log('  Admin: admin@example.com')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
