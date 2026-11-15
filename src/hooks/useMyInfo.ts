import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '../lib/api'

export type HomeownerInfo = {
  property_street: string | null
  property_unit: string | null
  property_city: string | null
  property_zip: string | null
  property_county: string | null
  mailing_same: boolean
  mailing_street: string | null
  mailing_unit: string | null
  mailing_city: string | null
  mailing_state: string | null
  mailing_zip: string | null
  alt_phone: string | null
  preferred_contact: 'phone' | 'text' | 'email' | null
  best_time: string | null
  servicer_name: string | null
  hardship_reasons: string[]
  hardship_details: string | null
  updated_at?: string
}

export type ExtraEmail = { id: string; email: string; label: string | null }

export type HouseholdMember = {
  id: string
  is_self: boolean
  full_name: string
  relationship: string
  on_mortgage: boolean
  income_types: string[]
  employer: string | null
}

export type TeamContact = {
  id: string
  role: 'attorney' | 'other'
  directory_profile_id: string | null
  name: string
  firm: string | null
  phone: string | null
  email: string | null
  status: 'contacted' | 'consultation' | 'retained' | 'done'
  notes: string | null
  created_at: string
}

export type MyInfo = {
  profile: { email: string; full_name: string | null; phone: string | null }
  info: HomeownerInfo | null
  emails: ExtraEmail[]
  household: HouseholdMember[]
  team: TeamContact[]
}

export function useMyInfo() {
  const [data, setData] = useState<MyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // No synchronous setState here — it runs from the mount effect
  const fetchInfo = useCallback(() => {
    apiGet<MyInfo>('/me')
      .then(res => {
        setData(res)
        setError(null)
      })
      .catch(err => {
        console.error('Error loading My Information:', err)
        setError('Failed to load your information. Please refresh.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchInfo()
  }, [fetchInfo])

  // Local updates after a save, so sections don't reload the whole page
  const patch = (fn: (prev: MyInfo) => MyInfo) => setData(prev => (prev ? fn(prev) : prev))

  return { data, loading, error, reload: fetchInfo, patch }
}

// How complete the homeowner's information is, for the progress meter
export function infoProgress(d: MyInfo | null) {
  if (!d) return { done: 0, total: 4, sections: { contact: false, property: false, household: false, hardship: false } }
  const i = d.info
  const sections = {
    contact: Boolean(d.profile.full_name && d.profile.phone),
    property: Boolean(i?.property_street && i.property_city && i.property_zip),
    household: d.household.some(m => m.is_self && m.income_types.length > 0),
    hardship: Boolean(i && i.hardship_reasons.length > 0)
  }
  return { done: Object.values(sections).filter(Boolean).length, total: 4, sections }
}
