import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { apiGet } from '../lib/api'
import { setAccessToken } from '../lib/tokenStore'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string, phone?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>
  isAdmin: boolean
  isInvestor: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async () => {
    try {
      return await apiGet<Profile>('/profile')
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }

  useEffect(() => {
    let initialLoad = true

    // Fallback: if INITIAL_SESSION never fires, unblock the app after 5s
    const timeout = setTimeout(() => {
      if (initialLoad) {
        setLoading(false)
        initialLoad = false
      }
    }, 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // The event fired, so the fallback isn't needed. Keep loading=true until the
        // profile arrives (Render cold starts can take ~20s) so route guards don't
        // see a user with no role.
        clearTimeout(timeout)
        setAccessToken(session?.access_token ?? null)
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          const profile = await fetchProfile()
          setProfile(profile)
        } else {
          setProfile(null)
        }
        if (initialLoad) {
          setLoading(false)
          initialLoad = false
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, fullName?: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone
        }
      }
    })

    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      // SIGNED_OUT isn't emitted when the call fails (offline, 5xx), so clear local state ourselves
      console.error('Sign out error:', error)
      setAccessToken(null)
      setSession(null)
      setUser(null)
      setProfile(null)
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/reset-password`
    })
    return { error }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    isAdmin: profile?.role === 'admin',
    isInvestor: profile?.role === 'investor'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
