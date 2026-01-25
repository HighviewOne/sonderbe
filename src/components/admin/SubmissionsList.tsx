import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { ContactSubmission } from '../../lib/supabase'

type StatusFilter = 'all' | ContactSubmission['status']

export function SubmissionsList() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null)

  useEffect(() => {
    loadSubmissions()
  }, [])

  const loadSubmissions = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading submissions:', error)
    } else {
      setSubmissions(data as ContactSubmission[])
    }
    setLoading(false)
  }

  const updateStatus = async (id: string, status: ContactSubmission['status']) => {
    const { error } = await supabase
      .from('contact_submissions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setSubmissions(subs =>
        subs.map(s => s.id === id ? { ...s, status } : s)
      )
    }
  }

  const saveNotes = async () => {
    if (!editingNotes) return

    const { error } = await supabase
      .from('contact_submissions')
      .update({ admin_notes: editingNotes.notes, updated_at: new Date().toISOString() })
      .eq('id', editingNotes.id)

    if (!error) {
      setSubmissions(subs =>
        subs.map(s => s.id === editingNotes.id ? { ...s, admin_notes: editingNotes.notes } : s)
      )
      setEditingNotes(null)
    }
  }

  const filteredSubmissions = statusFilter === 'all'
    ? submissions
    : submissions.filter(s => s.status === statusFilter)

  const statusCounts = {
    all: submissions.length,
    new: submissions.filter(s => s.status === 'new').length,
    in_progress: submissions.filter(s => s.status === 'in_progress').length,
    resolved: submissions.filter(s => s.status === 'resolved').length,
    archived: submissions.filter(s => s.status === 'archived').length
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading submissions...</p>
      </div>
    )
  }

  return (
    <div className="submissions-list">
      <div className="page-header">
        <h1>Contact Submissions</h1>
        <p>{submissions.length} total submissions</p>
      </div>

      <div className="filter-tabs">
        {(['all', 'new', 'in_progress', 'resolved', 'archived'] as StatusFilter[]).map(status => (
          <button
            key={status}
            className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ')}
            <span className="count">{statusCounts[status]}</span>
          </button>
        ))}
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="empty-state">No submissions found</div>
      ) : (
        <div className="submissions-cards">
          {filteredSubmissions.map(sub => (
            <div key={sub.id} className={`submission-card ${sub.status === 'new' ? 'new' : ''}`}>
              <div className="submission-header" onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}>
                <div className="submission-main">
                  <h3>{sub.name}</h3>
                  <span className="submission-date">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="submission-meta">
                  <span className="submission-situation">{sub.situation}</span>
                  <select
                    value={sub.status}
                    onChange={(e) => {
                      e.stopPropagation()
                      updateStatus(sub.id, e.target.value as ContactSubmission['status'])
                    }}
                    className={`status-select status-${sub.status}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <span className="expand-icon">{expandedId === sub.id ? '−' : '+'}</span>
              </div>

              {expandedId === sub.id && (
                <div className="submission-details">
                  <div className="detail-row">
                    <label>Email:</label>
                    <a href={`mailto:${sub.email}`}>{sub.email}</a>
                  </div>
                  <div className="detail-row">
                    <label>Phone:</label>
                    <a href={`tel:${sub.phone}`}>{sub.phone}</a>
                  </div>
                  {sub.message && (
                    <div className="detail-row full-width">
                      <label>Message:</label>
                      <p>{sub.message}</p>
                    </div>
                  )}
                  {sub.user_id && (
                    <div className="detail-row">
                      <label>Client Account:</label>
                      <Link to={`/admin/clients/${sub.user_id}`}>View Client Profile</Link>
                    </div>
                  )}
                  <div className="detail-row full-width">
                    <label>Admin Notes:</label>
                    {editingNotes?.id === sub.id ? (
                      <div className="notes-editor">
                        <textarea
                          value={editingNotes.notes}
                          onChange={(e) => setEditingNotes({ ...editingNotes, notes: e.target.value })}
                          placeholder="Add notes about this submission..."
                        />
                        <div className="notes-actions">
                          <button className="btn btn-small" onClick={saveNotes}>Save</button>
                          <button className="btn btn-small btn-secondary" onClick={() => setEditingNotes(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="notes-display">
                        <p>{sub.admin_notes || 'No notes yet'}</p>
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={() => setEditingNotes({ id: sub.id, notes: sub.admin_notes || '' })}
                        >
                          {sub.admin_notes ? 'Edit Notes' : 'Add Notes'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
