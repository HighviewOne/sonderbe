import { supabaseAdmin } from './config.js'

const ACTIVE = new Set(['active', 'trialing'])

// Professionals with access: their own active subscription, or membership in a brokerage
// whose owner (the broker) has an active subscription. Returns null on a DB error.
export async function professionalsWithAccess(ids: string[]): Promise<Set<string> | null> {
  if (ids.length === 0) return new Set()
  const { data: profiles, error } = await supabaseAdmin.from('profiles').select('id, brokerage_id').in('id', ids)
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
  const { data: subs, error: sError } = await supabaseAdmin.from('investor_subscriptions').select('user_id, status').in('user_id', payerIds)
  if (sError) {
    console.error('Failed to load subscriptions for access check:', sError)
    return null
  }
  const paying = new Set(subs.filter(s => ACTIVE.has(s.status)).map(s => s.user_id))
  return new Set(profiles
    .filter(p => paying.has(p.id) || (p.brokerage_id && paying.has(ownerOf.get(p.brokerage_id) ?? '')))
    .map(p => p.id))
}
