import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiDelete, apiPatch } from '../lib/api'
import type { Category, ProfessionalType, Stage } from '../lib/constants'

export type MatchRequest = {
  id: string
  category: Category
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
  avatar_url: string | null
  brokerage: { name: string; logo_url: string | null } | null
  accepting: boolean
  email?: string
  phone?: string | null
}

export type MatchedProfessional = Partial<DirectoryEntry> & {
  full_name: string | null
  email: string
  phone: string | null
  office?: ProfessionalOffice | null
}

export type CaseEvent = { id: string; stage: Stage; note: string | null; created_at: string; by_homeowner: boolean }

export type CaseDocument = {
  id: string
  label: string
  sort_order: number
  homeowner_note: string | null
  sent_at: string | null
  received_at: string | null
  doc_type: string | null
  household_member_id: string | null
  round: number
  refresh_days: number | null
  request_reason: string | null
  due_date: string | null
  last_received_at: string | null
  stale: boolean
  expires_on: string | null
}

export type CaseNote = {
  id: string
  document_id: string | null
  author_role: 'homeowner' | 'professional'
  body: string
  created_at: string
}

export type ProfessionalOffice = {
  office_street: string | null
  office_unit: string | null
  office_city: string | null
  office_state: string | null
  office_zip: string | null
  office_phone: string | null
  fax: string | null
  document_email: string | null
  document_instructions: string | null
  office_hours: string | null
}

export type MatchCase = {
  category: Category
  request: MatchRequest
  professional: MatchedProfessional | null
  events: CaseEvent[]
  documents: CaseDocument[]
  notes: CaseNote[]
  unread_notes: number
}

type MatchResponse = {
  cases: MatchCase[]
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
        setError('Failed to load your cases. Please refresh.')
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

  const withdraw = async (requestId: string) => {
    await apiDelete(`/match/${requestId}`)
    reload()
  }

  // Updates the one row in place so the list doesn't flash a loading state
  const markSent = async (docId: string, sent: boolean, note?: string) => {
    const updated = await apiPatch<CaseDocument>(`/match/documents/${docId}`, note === undefined ? { sent } : { sent, note })
    setData(prev => prev && {
      ...prev,
      cases: prev.cases.map(c => ({ ...c, documents: c.documents.map(d => d.id === docId ? updated : d) }))
    })
  }

  const sendNote = async (requestId: string, body: string, documentId: string | null) => {
    const note = await apiPost<CaseNote>(`/match/${requestId}/notes`, { body, document_id: documentId })
    setData(prev => prev && {
      ...prev,
      cases: prev.cases.map(c => c.request.id === requestId ? { ...c, notes: [...c.notes, note], unread_notes: 0 } : c)
    })
  }

  const markNotesRead = async (requestId: string) => {
    await apiPost(`/match/${requestId}/notes/read`)
    setData(prev => prev && {
      ...prev,
      cases: prev.cases.map(c => c.request.id === requestId ? { ...c, unread_notes: 0 } : c)
    })
  }

  const cases = data?.cases ?? []
  return {
    sendNote,
    markNotesRead,
    cases,
    activeCases: cases.filter(c => c.request.status === 'claimed'),
    consentText: data?.consent_text ?? '',
    loading,
    error,
    chooseProfessional,
    withdraw,
    markSent,
    reload
  }
}
