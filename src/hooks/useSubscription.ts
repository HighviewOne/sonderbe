import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '../lib/api'
import type { InvestorSubscription } from '../lib/supabase'

export function useSubscription() {
  const [subscription, setSubscription] = useState<InvestorSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSubscription = useCallback(async () => {
    try {
      const data = await apiGet<InvestorSubscription>('/investor/subscription')
      setSubscription(data.status !== 'inactive' ? data : null)
    } catch {
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const createCheckout = async () => {
    const data = await apiPost<{ url: string }>('/stripe/create-checkout')
    if (data.url) {
      window.location.href = data.url
    }
  }

  const openBillingPortal = async () => {
    const data = await apiPost<{ url: string }>('/stripe/portal')
    if (data.url) {
      window.location.href = data.url
    }
  }

  return { subscription, loading, createCheckout, openBillingPortal, refetch: fetchSubscription }
}
