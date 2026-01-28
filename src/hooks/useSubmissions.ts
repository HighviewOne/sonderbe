import { useState, useEffect, useCallback } from 'react'
import type { ContactSubmission } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { apiGet, apiPost, apiPatch } from '../lib/api'

interface SubmissionData {
  name: string
  email: string
  phone: string
  situation: string
  message?: string
}

export function useSubmissions() {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSubmissions = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const data = await apiGet<ContactSubmission[]>('/submissions')
      setSubmissions(data)
    } catch (err) {
      console.error('Error loading submissions:', err)
      setError('Failed to load submissions')
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  const submitForm = async (data: SubmissionData): Promise<boolean> => {
    setSubmitting(true)
    setError(null)

    try {
      await apiPost('/submissions', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        situation: data.situation,
        message: data.message || null
      })
      setSubmitting(false)
      return true
    } catch (err) {
      console.error('Error submitting form:', err)
      setError('Failed to submit form. Please try again.')
      setSubmitting(false)
      return false
    }
  }

  const updateStatus = async (
    submissionId: string,
    status: ContactSubmission['status'],
    adminNotes?: string
  ): Promise<boolean> => {
    try {
      const updateData: Record<string, unknown> = { status }
      if (adminNotes !== undefined) {
        updateData.admin_notes = adminNotes
      }

      const updated = await apiPatch<ContactSubmission>(`/submissions/${submissionId}`, updateData)

      setSubmissions(prev =>
        prev.map(sub =>
          sub.id === submissionId ? updated : sub
        )
      )

      return true
    } catch (err) {
      console.error('Error updating submission:', err)
      setError('Failed to update submission')
      return false
    }
  }

  return {
    submissions,
    loading,
    submitting,
    error,
    submitForm,
    updateStatus,
    reload: loadSubmissions
  }
}
