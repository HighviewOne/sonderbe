import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiDelete } from '../lib/api'

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
}

export type MatchedProfessional = {
  full_name: string | null
  email: string
  phone: string | null
}

type MatchResponse = {
  request: MatchRequest | null
  professional: MatchedProfessional | null
  consent_text: string
}

export type MatchInput = {
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
        setError('Failed to load your match status. Please refresh.')
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

  const requestMatch = async (input: MatchInput) => {
    await apiPost('/match', input)
    reload()
  }

  const withdraw = async () => {
    await apiDelete('/match')
    reload()
  }

  return {
    request: data?.request ?? null,
    professional: data?.professional ?? null,
    consentText: data?.consent_text ?? '',
    loading,
    error,
    requestMatch,
    withdraw,
    reload
  }
}
