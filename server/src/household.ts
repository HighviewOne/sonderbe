import { supabaseAdmin } from './config.js'

// Document kinds the example viewer knows. Keep in sync with src/lib/documentTypes.ts.
export const DOC_TYPES = [
  'bank_statement', 'tax_return', 'mortgage_statement', 'hardship_letter', 'irs_4506c',
  'pay_stub', 'profit_loss', 'benefit_letter', 'lease', 'court_order', 'contribution_letter', 'other'
] as const
export type DocType = typeof DOC_TYPES[number]

export type HouseholdMember = {
  id: string
  is_self: boolean
  full_name: string
  relationship: string
  on_mortgage: boolean
  income_types: string[]
  employer: string | null
}

export type GeneratedDoc = { label: string; doc_type: DocType; household_member_id: string | null }

// How long a received copy usually stays acceptable to a lender (days). NULL = doesn't expire.
// The professional can change it per document.
export const DEFAULT_REFRESH_DAYS: Record<DocType, number | null> = {
  bank_statement: 30,
  pay_stub: 30,
  mortgage_statement: 30,
  profit_loss: 90,
  irs_4506c: 120,
  benefit_letter: 365,
  tax_return: null,
  hardship_letter: null,
  lease: null,
  court_order: null,
  contribution_letter: null,
  other: null
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

// The documents a short sale or loan modification usually needs, built from the household
// so neither side has to type the list: household-wide items first, then one set per earner.
export function documentsForHousehold(members: HouseholdMember[]): GeneratedDoc[] {
  const docs: GeneratedDoc[] = [
    { label: 'Last 2 months of bank statements (all accounts, all pages)', doc_type: 'bank_statement', household_member_id: null },
    { label: 'Last 2 years of federal tax returns (all pages, signed)', doc_type: 'tax_return', household_member_id: null },
    { label: 'Most recent mortgage statement', doc_type: 'mortgage_statement', household_member_id: null },
    { label: 'Hardship letter (signed and dated)', doc_type: 'hardship_letter', household_member_id: null },
    { label: 'IRS Form 4506-C (signed), for each person on the loan', doc_type: 'irs_4506c', household_member_id: null }
  ]

  for (const m of members) {
    const who = m.is_self ? 'Your' : `${firstName(m.full_name)}'s`
    const add = (label: string, doc_type: DocType) => docs.push({ label: `${who} ${label}`, doc_type, household_member_id: m.id })
    for (const t of m.income_types) {
      switch (t) {
        case 'employment':
          add(`pay stubs, last 30 days${m.employer ? ` (${m.employer})` : ''}`, 'pay_stub')
          break
        case 'self_employment':
          add('year-to-date profit & loss statement', 'profit_loss')
          add('last 3 months of business bank statements', 'bank_statement')
          break
        case 'social_security':
          add('Social Security benefit letter (this year)', 'benefit_letter')
          break
        case 'disability':
          add('disability benefit letter', 'benefit_letter')
          break
        case 'pension':
          add('pension or retirement income statement', 'benefit_letter')
          break
        case 'unemployment':
          add('unemployment benefit letter and payment history', 'benefit_letter')
          break
        case 'rental':
          add('signed lease(s) for rental income', 'lease')
          break
        case 'child_support':
          add('child support or alimony court order', 'court_order')
          break
        case 'other':
          add('proof of other income', 'other')
          break
      }
    }
    // Income from someone not on the loan only counts with their written statement
    if (!m.is_self && !m.on_mortgage && m.income_types.length > 0) {
      add('signed letter saying they contribute to household expenses', 'contribution_letter')
    }
  }
  return docs
}

// Best guess at the kind of document from a typed label, for the example viewer
export function guessDocType(label: string): DocType {
  const l = label.toLowerCase()
  if (l.includes('4506')) return 'irs_4506c'
  if (l.includes('pay stub') || l.includes('paystub') || l.includes('paycheck')) return 'pay_stub'
  if (l.includes('profit') || l.includes('p&l')) return 'profit_loss'
  if (l.includes('bank statement')) return 'bank_statement'
  if (l.includes('tax return') || l.includes('1040') || l.includes('w-2') || l.includes('w2')) return 'tax_return'
  if (l.includes('mortgage statement')) return 'mortgage_statement'
  if (l.includes('hardship')) return 'hardship_letter'
  if (l.includes('benefit') || l.includes('social security') || l.includes('pension') || l.includes('unemployment')) return 'benefit_letter'
  if (l.includes('lease')) return 'lease'
  if (l.includes('court order') || l.includes('child support') || l.includes('alimony') || l.includes('divorce decree')) return 'court_order'
  if (l.includes('contribut')) return 'contribution_letter'
  return 'other'
}

// The homeowner's own row is created on first read, from their profile name
export async function loadHousehold(userId: string, fallbackName: string): Promise<HouseholdMember[] | null> {
  const fields = 'id, is_self, full_name, relationship, on_mortgage, income_types, employer'
  const { data, error } = await supabaseAdmin
    .from('household_members').select(fields).eq('user_id', userId)
    .order('is_self', { ascending: false }).order('sort_order').order('created_at')
  if (error) {
    console.error('Failed to load household:', error)
    return null
  }
  if (data.some(m => m.is_self)) return data
  const { data: self, error: insertError } = await supabaseAdmin
    .from('household_members')
    .insert({ user_id: userId, is_self: true, full_name: fallbackName || 'Me', relationship: 'self', on_mortgage: true })
    .select(fields).single()
  if (insertError) {
    // A concurrent first read may have created it already
    const { data: again } = await supabaseAdmin.from('household_members').select(fields).eq('user_id', userId)
      .order('is_self', { ascending: false }).order('sort_order').order('created_at')
    return again ?? null
  }
  return [self, ...data]
}
