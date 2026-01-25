import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Document } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useDocuments() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading documents:', error)
      setError('Failed to load documents')
    } else {
      setDocuments(data as Document[])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const uploadDocument = async (file: File, category?: string): Promise<Document | null> => {
    if (!user) {
      setError('You must be logged in to upload documents')
      return null
    }

    setUploading(true)
    setError(null)

    const fileName = `${user.id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      setError('Failed to upload file')
      setUploading(false)
      return null
    }

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        mime_type: file.type,
        category: category || null,
        status: 'uploaded'
      })
      .select()
      .single()

    if (docError) {
      console.error('Error creating document record:', docError)
      setError('Failed to save document metadata')
      setUploading(false)
      return null
    }

    const newDoc = docData as Document
    setDocuments(prev => [newDoc, ...prev])
    setUploading(false)
    return newDoc
  }

  const deleteDocument = async (documentId: string, filePath: string) => {
    if (!user) return false

    const { error: storageError } = await supabase.storage
      .from('client-documents')
      .remove([filePath])

    if (storageError) {
      console.error('Error deleting file from storage:', storageError)
    }

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id)

    if (dbError) {
      console.error('Error deleting document record:', dbError)
      setError('Failed to delete document')
      return false
    }

    setDocuments(prev => prev.filter(doc => doc.id !== documentId))
    return true
  }

  const getDownloadUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(filePath, 3600)

    if (error) {
      console.error('Error creating signed URL:', error)
      return null
    }

    return data.signedUrl
  }

  return {
    documents,
    loading,
    uploading,
    error,
    uploadDocument,
    deleteDocument,
    getDownloadUrl,
    reload: loadDocuments
  }
}
