import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiDelete, apiPatch } from '../lib/api'
import type { ProfessionalType, Stage } from '../lib/constants'

export type MatchRequest = {
  id: string
  county: string
  situation: string
  contact_name: string
  contact_phone: string | null
  best_time: string | null
  status: 'open' | 'claimed' | 'closed' | 'withdrawn'
  claimed_at: string | null
  created_at: string
  stage: Stage
  next_step: string | null
  outcome: string | null
  stage_updated_at: string | null
}

export type DirectoryEntry = {
  id: string
  full_name: string | null
  business_name: string | null
  professional_type: ProfessionalType
  bio: string | null
  website: string | null
  license_number: string | null
  license_verified: boolean
  licensed_profession: boolean
  direct_contact_only: boolean
  service_counties: string[]
  accepting: boolean
  email?: string
  phone?: string | null
}

export type MatchedProfessional = Partial<DirectoryEntry> & {
  full_name: string | null
  email: string
  phone: string | null
}

export type CaseEvent = { id: string; stage: Stage; note: string | null; created_at: string; by_homeowner: boolean }

export type CaseDocument = {
  id: string
  label: string
  sort_order: number
  homeowner_note: string | null
  sent_at: string | null
  received_at: string | null
}

type MatchResponse = {
  request: MatchRequest | null
  professional: MatchedProfessional | null
  events: CaseEvent[]
  documents: CaseDocument[]
  consent_text: string
}

export type MatchInput = {
  professional_id: string
  county: string
  situation: string
  contact_name: string
  contact_phone: string
  best_time: string
  consent: boolean
}

export function useMatch() {
  const [data, setData] = useState<MatchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // No synchronous setState here — it runs from the mount effect
  const fetchMatch = useCallback(() => {
    apiGet<MatchResponse>('/match')
      .then((res) => {
        setData(res)
        setError(null)
      })
      .catch((err) => {
        console.error('Error loading match request:', err)
        setError('Failed to load your case. Please refresh.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchMatch()
  }, [fetchMatch])

  const reload = () => {
    setLoading(true)
    fetchMatch()
  }

  const chooseProfessional = async (input: MatchInput) => {
    await apiPost('/match', input)
    reload()
  }

  const withdraw = async () => {
    await apiDelete('/match')
    reload()
  }

  // Updates the one row in place so the list doesn't flash a loading state
  const markSent = async (docId: string, sent: boolean, note?: string) => {
    const updated = await apiPatch<CaseDocument>(`/match/documents/${docId}`, note === undefined ? { sent } : { sent, note })
    setData(prev => prev && { ...prev, documents: prev.documents.map(d => d.id === docId ? updated : d) })
  }

  return {
    request: data?.request ?? null,
    professional: data?.professional ?? null,
    events: data?.events ?? [],
    documents: data?.documents ?? [],
    consentText: data?.consent_text ?? '',
    loading,
    error,
    chooseProfessional,
    withdraw,
    markSent,
    reload
  }
}
