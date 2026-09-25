import { useState, useEffect, useCallback } from 'react'
import type { Document } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { apiGet, apiUpload, apiDelete } from '../lib/api'

export function useDocuments() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only sets state in promise callbacks, so it's safe to call from the effect.
  // With no user, `loading` is derived as false below.
  const fetchDocuments = useCallback(() => {
    if (!user) return Promise.resolve()
    return apiGet<Document[]>('/documents')
      .then(setDocuments)
      .catch(err => {
        console.error('Error loading documents:', err)
        setError('Failed to load documents')
      })
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    await fetchDocuments()
  }, [fetchDocuments])

  const uploadDocument = async (file: File, category?: string): Promise<Document | null> => {
    if (!user) {
      setError('You must be logged in to upload documents')
      return null
    }

    setUploading(true)
    setError(null)

    try {
      const extraFields: Record<string, string> = {}
      if (category) extraFields.category = category

      const newDoc = await apiUpload<Document>('/documents/upload', file, extraFields)
      setDocuments(prev => [newDoc, ...prev])
      setUploading(false)
      return newDoc
    } catch (err) {
      console.error('Error uploading document:', err)
      setError('Failed to upload file')
      setUploading(false)
      return null
    }
  }

  const deleteDocument = async (documentId: string) => {
    if (!user) return false

    try {
      await apiDelete(`/documents/${documentId}`)
      setDocuments(prev => prev.filter(doc => doc.id !== documentId))
      return true
    } catch (err) {
      console.error('Error deleting document:', err)
      setError('Failed to delete document')
      return false
    }
  }

  const getDownloadUrl = async (documentId: string): Promise<string | null> => {
    try {
      const data = await apiGet<{ url: string }>(`/documents/${documentId}/download`)
      return data.url
    } catch (err) {
      console.error('Error getting download URL:', err)
      return null
    }
  }

  return {
    documents,
    loading: user ? loading : false,
    uploading,
    error,
    uploadDocument,
    deleteDocument,
    getDownloadUrl,
    reload: loadDocuments
  }
}
