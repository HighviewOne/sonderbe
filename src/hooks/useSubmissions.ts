import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ContactSubmission } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface SubmissionData {
  name: string
  email: string
  phone: string
  situation: string
  message?: string
}

export function useSubmissions() {
  const { user, isAdmin } = useAuth()
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

    let query = supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading submissions:', error)
      setError('Failed to load submissions')
    } else {
      setSubmissions(data as ContactSubmission[])
    }
    setLoading(false)
  }, [user, isAdmin])

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  const submitForm = async (data: SubmissionData): Promise<boolean> => {
    setSubmitting(true)
    setError(null)

    const { error: submitError } = await supabase
      .from('contact_submissions')
      .insert({
        user_id: user?.id || null,
        name: data.name,
        email: data.email,
        phone: data.phone,
        situation: data.situation,
        message: data.message || null,
        status: 'new'
      })

    if (submitError) {
      console.error('Error submitting form:', submitError)
      setError('Failed to submit form. Please try again.')
      setSubmitting(false)
      return false
    }

    setSubmitting(false)
    return true
  }

  const updateStatus = async (
    submissionId: string,
    status: ContactSubmission['status'],
    adminNotes?: string
  ): Promise<boolean> => {
    if (!isAdmin) {
      setError('Only admins can update submission status')
      return false
    }

    const updateData: Partial<ContactSubmission> = {
      status,
      updated_at: new Date().toISOString()
    }

    if (adminNotes !== undefined) {
      updateData.admin_notes = adminNotes
    }

    const { error: updateError } = await supabase
      .from('contact_submissions')
      .update(updateData)
      .eq('id', submissionId)

    if (updateError) {
      console.error('Error updating submission:', updateError)
      setError('Failed to update submission')
      return false
    }

    setSubmissions(prev =>
      prev.map(sub =>
        sub.id === submissionId
          ? { ...sub, ...updateData }
          : sub
      )
    )

    return true
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
