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
import { CONSENT_TEXT } from '../src/matching.js'

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

function must<T>(result: { data: T; error: unknown }, what: string): T {
  if (result.error) throw new Error(`${what}: ${JSON.stringify(result.error)}`)
  return result.data
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
    email: 'pro.agent@example.com', full_name: 'Maria Lopez', phone: '(213) 555-0141',
    professional_type: 'agent', business_name: 'Lopez Short Sale Realty',
    bio: 'Short-sale listing agent for 12 years. I work with your lender so the sale closes before the auction date. Paid only from the sale at closing.',
    website: 'https://example.com/lopez', license_number: 'DEMO-DRE-01234567', license_verified: true,
    service_counties: ['Los Angeles', 'Orange']
  },
  {
    email: 'pro.broker@example.com', full_name: 'David Chen', phone: '(562) 555-0187',
    professional_type: 'broker', business_name: 'Harbor Brokerage Group',
    bio: 'Broker with a team of four short-sale agents. Bilingual English/Mandarin.',
    website: 'https://example.com/harbor', license_number: 'DEMO-DRE-07654321', license_verified: true,
    service_counties: ['Los Angeles', 'Orange', 'Riverside']
  },
  {
    email: 'pro.attorney@example.com', full_name: 'Sarah Kim', phone: '(310) 555-0112',
    professional_type: 'attorney', business_name: 'Kim Homeowner Defense Law',
    bio: 'Foreclosure defense and bankruptcy attorney. Free first consultation.',
    website: 'https://example.com/kimlaw', license_number: 'DEMO-SBN-298765', license_verified: true,
    service_counties: ['Los Angeles']
  },
  {
    email: 'pro.legal@example.com', full_name: 'James Carter', phone: '(951) 555-0166',
    professional_type: 'legal_professional', business_name: 'Carter Document Services',
    bio: 'Registered legal document assistant. I help prepare paperwork; I do not give legal advice.',
    website: null, license_number: 'DEMO-LDA-4411', license_verified: false,
    service_counties: ['Los Angeles', 'Riverside']
  },
  {
    email: 'pro.negotiator@example.com', full_name: 'Tony Reyes', phone: '(818) 555-0199',
    professional_type: 'negotiator', business_name: 'Reyes Lender Negotiation',
    bio: 'I negotiate with lenders on short-sale approvals for listing agents and homeowners.',
    website: null, license_number: null, license_verified: false,
    service_counties: ['Los Angeles']
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
    must(await db.from('investor_subscriptions').insert({
      user_id: id,
      stripe_customer_id: `cus_demo_${p.professional_type}`,
      status: 'active',
      current_period_start: daysAgo(10),
      current_period_end: daysAgo(-20)
    }), `subscription ${p.email}`)
    ids[p.professional_type] = id
  }
  return ids
}

// ---------------------------------------------------------------------------
// Homeowners and their cases
// ---------------------------------------------------------------------------
type Stage = 'matched' | 'first_contact' | 'documents_requested' | 'documents_received' |
  'submitted_to_lender' | 'lender_review' | 'outcome'

interface CaseSeed {
  pro: string
  situation: string
  stage: Stage
  next_step: string
  events: { stage: Stage; note: string; days: number }[]
  documents?: { label: string; sent?: number; received?: number; note?: string }[]
}

interface HomeownerSeed {
  email: string
  full_name: string
  phone: string
  checklist: [number, number][] // [category_index, item_index] already checked
  case?: CaseSeed
}

const STANDARD_DOCS = [
  'Last 2 months of bank statements (all accounts)',
  'Last 2 years of tax returns',
  'Last 30 days of pay stubs',
  'Hardship letter (why you fell behind)',
  'Most recent mortgage statement'
]

const HOMEOWNERS: HomeownerSeed[] = [
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
      ]
    }
  },
  {
    email: 'home.docs@example.com', full_name: 'Angela Brooks', phone: '(626) 555-0103',
    checklist: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]],
    case: {
      pro: 'agent', situation: 'behind', stage: 'documents_requested',
      next_step: 'Send the remaining documents by email so I can open the short-sale file with your lender.',
      events: [
        { stage: 'matched', note: 'You chose Maria Lopez.', days: 9 },
        { stage: 'first_contact', note: 'Phone call: agreed to list the home as a short sale.', days: 8 },
        { stage: 'documents_requested', note: 'Sent the document list.', days: 6 }
      ],
      documents: [
        { label: STANDARD_DOCS[0], sent: 4, received: 3 },
        { label: STANDARD_DOCS[1], sent: 2, note: 'Emailed both years as PDFs' },
        { label: STANDARD_DOCS[2] },
        { label: STANDARD_DOCS[3] },
        { label: STANDARD_DOCS[4], sent: 5, received: 5 }
      ]
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
      documents: STANDARD_DOCS.map((label, i) => ({ label, sent: 36 - i, received: 31 }))
    }
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

    if (!h.case) continue
    const c = h.case
    const first = c.events[0].days
    const request = must(await db.from('match_requests').insert({
      homeowner_id: id,
      county: 'Los Angeles',
      situation: c.situation,
      contact_name: h.full_name,
      contact_email: h.email,
      contact_phone: h.phone,
      best_time: 'Weekday evenings',
      consent_text: CONSENT_TEXT,
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
      must(await db.from('case_documents').insert(c.documents.map((d, i) => ({
        match_request_id: request.id, label: d.label, sort_order: i,
        homeowner_note: d.note ?? null,
        sent_at: d.sent !== undefined ? daysAgo(d.sent) : null,
        received_at: d.received !== undefined ? daysAgo(d.received) : null
      }))), `documents ${h.email}`)
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
      business_name: 'SoCal Gentle Movers', category: 'movers',
      headline: 'Local moves from $95/hour, 2-hour minimum',
      description: 'Licensed, insured household movers. Free in-home or video estimate.',
      phone: '(213) 555-0170', website: 'https://example.com/movers',
      license_label: 'Cal-T', license_number: 'DEMO-190000', counties: ['Los Angeles', 'Orange'], active: true
    },
    {
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
  console.log('  Professionals: pro.agent / pro.broker / pro.attorney / pro.legal / pro.negotiator @example.com')
  console.log('  Admin: admin@example.com')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
