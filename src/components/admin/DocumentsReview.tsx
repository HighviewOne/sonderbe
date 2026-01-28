import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Document, Profile } from '../../lib/supabase'
import { apiGet, apiPatch } from '../../lib/api'

type StatusFilter = 'all' | Document['status']

interface DocumentWithClient extends Document {
  client?: Profile | null
}

export function DocumentsReview() {
  const [documents, setDocuments] = useState<DocumentWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('uploaded')
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    setLoading(true)

    try {
      const data = await apiGet<DocumentWithClient[]>('/admin/documents')
      setDocuments(data)
    } catch (err) {
      console.error('Error loading documents:', err)
    }

    setLoading(false)
  }

  const updateStatus = async (id: string, status: Document['status']) => {
    try {
      await apiPatch(`/documents/${id}`, { status })
      setDocuments(docs =>
        docs.map(d => d.id === id ? { ...d, status } : d)
      )
    } catch (err) {
      console.error('Error updating document status:', err)
    }
  }

  const saveNotes = async () => {
    if (!editingNotes) return

    try {
      await apiPatch(`/documents/${editingNotes.id}`, { admin_notes: editingNotes.notes })
      setDocuments(docs =>
        docs.map(d => d.id === editingNotes.id ? { ...d, admin_notes: editingNotes.notes } : d)
      )
      setEditingNotes(null)
    } catch (err) {
      console.error('Error saving notes:', err)
    }
  }

  const handleDownload = async (docId: string) => {
    try {
      const data = await apiGet<{ url: string }>(`/documents/${docId}/download`)
      if (data.url) window.open(data.url, '_blank')
    } catch (err) {
      console.error('Error getting download URL:', err)
    }
  }

  const filteredDocs = statusFilter === 'all'
    ? documents
    : documents.filter(d => d.status === statusFilter)

  const statusCounts = {
    all: documents.length,
    uploaded: documents.filter(d => d.status === 'uploaded').length,
    reviewed: documents.filter(d => d.status === 'reviewed').length,
    approved: documents.filter(d => d.status === 'approved').length,
    rejected: documents.filter(d => d.status === 'rejected').length
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading documents...</p>
      </div>
    )
  }

  return (
    <div className="documents-review">
      <div className="page-header">
        <h1>Document Review</h1>
        <p>{documents.length} total documents</p>
      </div>

      <div className="filter-tabs">
        {(['all', 'uploaded', 'reviewed', 'approved', 'rejected'] as StatusFilter[]).map(status => (
          <button
            key={status}
            className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status === 'all' ? 'All' : status}
            <span className="count">{statusCounts[status]}</span>
          </button>
        ))}
      </div>

      {filteredDocs.length === 0 ? (
        <div className="empty-state">No documents found</div>
      ) : (
        <div className="documents-table-container">
          <table className="admin-table documents-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Client</th>
                <th>Category</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => (
                <tr key={doc.id} className={doc.status === 'uploaded' ? 'pending-row' : ''}>
                  <td>
                    <button
                      className="link-button file-name"
                      onClick={() => handleDownload(doc.id)}
                    >
                      {doc.file_name}
                    </button>
                  </td>
                  <td>
                    {doc.client ? (
                      <Link to={`/admin/clients/${doc.user_id}`}>
                        {doc.client.full_name || doc.client.email}
                      </Link>
                    ) : (
                      'Unknown'
                    )}
                  </td>
                  <td>{doc.category || '-'}</td>
                  <td>{formatFileSize(doc.file_size)}</td>
                  <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                  <td>
                    <select
                      value={doc.status}
                      onChange={(e) => updateStatus(doc.id, e.target.value as Document['status'])}
                      className={`status-select status-${doc.status}`}
                    >
                      <option value="uploaded">Uploaded</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn btn-small"
                      onClick={() => handleDownload(doc.id)}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => setEditingNotes({ id: doc.id, notes: doc.admin_notes || '' })}
                    >
                      Notes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingNotes && (
        <div className="modal-overlay" onClick={() => setEditingNotes(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Admin Notes</h3>
            <textarea
              value={editingNotes.notes}
              onChange={(e) => setEditingNotes({ ...editingNotes, notes: e.target.value })}
              placeholder="Add notes about this document..."
              rows={4}
            />
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveNotes}>Save</button>
              <button className="btn btn-secondary" onClick={() => setEditingNotes(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
