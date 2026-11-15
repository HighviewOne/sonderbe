import { supabaseAdmin } from './config.js'

// What a professional can do, from their own subscription or their broker's:
// - active:    paying (or trialing)
// - grace:     a payment failed less than GRACE_DAYS ago; full access while Stripe retries
// - read_only: subscription ended (or payment failing past the grace period) less than
//              READ_ONLY_DAYS ago; can look but not change anything, hidden from the directory.
//              Also an agent who left their brokerage (left_brokerage_at) without their own subscription.
// - ended:     past read-only; their open cases get closed for the homeowner
// - none:      never subscribed
export type AccessState = 'active' | 'grace' | 'read_only' | 'ended' | 'none'
export type Access = { state: AccessState; until: string | null; via: 'own' | 'brokerage' | null }

export const GRACE_DAYS = 14
export const READ_ONLY_DAYS = 14
const DAY = 86_400_000
const RANK: Record<AccessState, number> = { active: 4, grace: 3, read_only: 2, ended: 1, none: 0 }

type SubRow = { user_id: string; status: string; past_due_since: string | null; ended_at: string | null; updated_at: string | null }

export function stateOf(sub: SubRow | undefined, now = Date.now()): { state: AccessState; until: string | null } {
  if (!sub) return { state: 'none', until: null }
  if (sub.status === 'active' || sub.status === 'trialing') return { state: 'active', until: null }
  if (sub.status === 'past_due') {
    const since = new Date(sub.past_due_since ?? sub.updated_at ?? now).getTime()
    if (now < since + GRACE_DAYS * DAY) return { state: 'grace', until: new Date(since + GRACE_DAYS * DAY).toISOString() }
    const end = since + (GRACE_DAYS + READ_ONLY_DAYS) * DAY
    return now < end ? { state: 'read_only', until: new Date(end).toISOString() } : { state: 'ended', until: null }
  }
  if (sub.ended_at) {
    const end = new Date(sub.ended_at).getTime() + READ_ONLY_DAYS * DAY
    return now < end ? { state: 'read_only', until: new Date(end).toISOString() } : { state: 'ended', until: null }
  }
  // 'inactive' with no end date = started checkout but never paid
  return { state: 'none', until: null }
}

// When a subscription that stops after a payment failure "ended": at the end of the grace period
// (not when Stripe finally gives up), so grace + read-only never adds up to more than 28 days.
export function endedAtFor(existingEndedAt: string | null, pastDueSince: string | null, now = Date.now()): string {
  if (existingEndedAt) return existingEndedAt
  if (pastDueSince) return new Date(Math.min(now, new Date(pastDueSince).getTime() + GRACE_DAYS * DAY)).toISOString()
  return new Date(now).toISOString()
}

// Read-only period for an agent who left (or was removed from) a brokerage
function afterLeaving(leftAt: string | null, now = Date.now()): { state: AccessState; until: string | null } {
  if (!leftAt) return { state: 'none', until: null }
  const end = new Date(leftAt).getTime() + READ_ONLY_DAYS * DAY
  return now < end ? { state: 'read_only', until: new Date(end).toISOString() } : { state: 'ended', until: null }
}

// Access for each professional id. Returns null on a DB error.
export async function accessFor(ids: string[]): Promise<Map<string, Access> | null> {
  const result = new Map<string, Access>()
  if (ids.length === 0) return result
  const { data: profiles, error } = await supabaseAdmin.from('profiles').select('id, brokerage_id, left_brokerage_at').in('id', ids)
  if (error) {
    console.error('Failed to load profiles for access check:', error)
    return null
  }
  const brokerageIds = [...new Set(profiles.map(p => p.brokerage_id).filter((b): b is string => Boolean(b)))]
  const { data: brokerages, error: bError } = brokerageIds.length
    ? await supabaseAdmin.from('brokerages').select('id, owner_id').in('id', brokerageIds)
    : { data: [] as { id: string; owner_id: string }[], error: null }
  if (bError) {
    console.error('Failed to load brokerages for access check:', bError)
    return null
  }
  const ownerOf = new Map(brokerages.map(b => [b.id, b.owner_id]))
  const payerIds = [...new Set([...ids, ...brokerages.map(b => b.owner_id)])]
  const { data: subs, error: sError } = await supabaseAdmin.from('investor_subscriptions')
    .select('user_id, status, past_due_since, ended_at, updated_at').in('user_id', payerIds)
  if (sError) {
    console.error('Failed to load subscriptions for access check:', sError)
    return null
  }
  const subOf = new Map(subs.map(s => [s.user_id, s as SubRow]))
  for (const p of profiles) {
    const ownSub = stateOf(subOf.get(p.id))
    const left = p.brokerage_id ? { state: 'none' as AccessState, until: null } : afterLeaving(p.left_brokerage_at)
    const own = RANK[left.state] > RANK[ownSub.state] ? left : ownSub
    const owner = p.brokerage_id ? ownerOf.get(p.brokerage_id) : undefined
    const viaBroker = owner && owner !== p.id ? stateOf(subOf.get(owner)) : { state: 'none' as AccessState, until: null }
    const best = RANK[viaBroker.state] > RANK[own.state]
      ? { ...viaBroker, via: 'brokerage' as const }
      : { ...own, via: own.state === 'none' ? null : 'own' as const }
    result.set(p.id, best)
  }
  for (const id of ids) if (!result.has(id)) result.set(id, { state: 'none', until: null, via: null })
  return result
}

// Professionals who can work right now (active or in a payment grace period)
export async function professionalsWithAccess(ids: string[]): Promise<Set<string> | null> {
  const access = await accessFor(ids)
  if (access === null) return null
  return new Set([...access].filter(([, a]) => a.state === 'active' || a.state === 'grace').map(([id]) => id))
}

export const canWork = (a: Access | undefined) => a?.state === 'active' || a?.state === 'grace'
