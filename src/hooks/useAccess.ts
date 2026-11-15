import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'

export type Access = {
  state: 'active' | 'grace' | 'read_only' | 'ended' | 'none'
  until: string | null
  via: 'own' | 'brokerage' | null
  brokerage_name: string | null
  demo_mode: boolean
}

// The signed-in professional's subscription state (see server/src/access.ts)
export function useAccess() {
  const [access, setAccess] = useState<Access | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Access>('/account/access')
      .then(setAccess)
      .catch(err => {
        console.error('Error checking subscription:', err)
        setError('Failed to check your subscription')
      })
  }, [])

  return { access, error }
}
