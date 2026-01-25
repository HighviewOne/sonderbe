import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Profile, ContactSubmission, Document, ChecklistProgress } from '../../lib/supabase'
import { checklistData } from '../../lib/constants'

export function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>()
  const [client, setClient] = useState<Profile | null>(null)
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [checklistProgress, setChecklistProgress] = useState<ChecklistProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientId) {
      loadClientData()
    }
  }, [clientId])

  const loadClientData = async () => {
    if (!clientId) return
    setLoading(true)

    const profileResult = await supabase.from('profiles').select('*').eq('id', clientId).single()
    const submissionsResult = await supabase.from('contact_submissions').select('*').eq('user_id', clientId).order('created_at', { ascending: false })
    const documentsResult = await supabase.from('documents').select('*').eq('user_id', clientId).order('created_at', { ascending: false })
    const checklistResult = await supabase.from('checklist_progress').select('*').eq('user_id', clientId)

    if (profileResult.data) setClient(profileResult.data as Profile)
    if (submissionsResult.data) setSubmissions(submissionsResult.data as ContactSubmission[])
    if (documentsResult.data) setDocuments(documentsResult.data as Document[])
    if (checklistResult.data) setChecklistProgress(checklistResult.data as ChecklistProgress[])

    setLoading(false)
  }

  const updateDocumentStatus = async (docId: string, status: Document['status'], notes?: string) => {
    const { error } = await supabase
      .from('documents')
      .update({ status, admin_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', docId)

    if (!error) {
      setDocuments(docs =>
        docs.map(d => d.id === docId ? { ...d, status, admin_notes: notes || d.admin_notes } : d)
      )
    }
  }

  const getDownloadUrl = async (filePath: string) => {
    const { data } = await supabase.storage.from('client-documents').createSignedUrl(filePath, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const getChecklistStats = () => {
    const totalItems = checklistData.reduce((sum, cat) => sum + cat.items.length, 0)
    const checkedItems = checklistProgress.filter(p => p.is_checked).length
    return {
      checked: checkedItems,
      total: totalItems,
      percentage: totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading client details...</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="error-container">
        <h2>Client Not Found</h2>
        <Link to="/admin/clients">Back to Clients</Link>
      </div>
    )
  }

  const stats = getChecklistStats()

  return (
    <div className="client-detail">
      <div className="page-header">
        <Link to="/admin/clients" className="back-link">Back to Clients</Link>
        <h1>{client.full_name || 'No Name'}</h1>
      </div>

      <div className="client-info-card">
        <h2>Client Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Email</label>
            <span>{client.email}</span>
          </div>
          <div className="info-item">
            <label>Phone</label>
            <span>{client.phone || 'Not provided'}</span>
          </div>
          <div className="info-item">
            <label>Joined</label>
            <span>{new Date(client.created_at).toLocaleDateString()}</span>
          </div>
          <div className="info-item">
            <label>Checklist Progress</label>
            <span>{stats.checked}/{stats.total} ({stats.percentage}%)</span>
          </div>
        </div>
      </div>

      <div className="client-sections">
        <div className="section-card">
          <h2>Submissions ({submissions.length})</h2>
          {submissions.length === 0 ? (
            <p className="empty-state">No submissions</p>
          ) : (
            <div className="submissions-list">
              {submissions.map(sub => (
                <div key={sub.id} className="submission-card">
                  <div className="submission-header">
                    <span className="submission-date">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </span>
                    <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
                  </div>
                  <div className="submission-content">
                    <p><strong>Situation:</strong> {sub.situation}</p>
                    {sub.message && <p><strong>Message:</strong> {sub.message}</p>}
                    {sub.admin_notes && <p><strong>Admin Notes:</strong> {sub.admin_notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-card">
          <h2>Documents ({documents.length})</h2>
          {documents.length === 0 ? (
            <p className="empty-state">No documents uploaded</p>
          ) : (
            <div className="documents-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <button
                          className="link-button"
                          onClick={() => getDownloadUrl(doc.file_path)}
                        >
                          {doc.file_name}
                        </button>
                      </td>
                      <td>{doc.category || '-'}</td>
                      <td>
                        <select
                          value={doc.status}
                          onChange={(e) => updateDocumentStatus(doc.id, e.target.value as Document['status'])}
                          className="status-select"
                        >
                          <option value="uploaded">Uploaded</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-small"
                          onClick={() => getDownloadUrl(doc.file_path)}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section-card">
          <h2>Checklist Progress ({stats.percentage}%)</h2>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${stats.percentage}%` }}></div>
          </div>
          <div className="checklist-summary">
            {checklistData.map((category, catIndex) => {
              const categoryItems = checklistProgress.filter(p => p.category_index === catIndex)
              const checked = categoryItems.filter(p => p.is_checked).length
              const total = category.items.length
              return (
                <div key={catIndex} className="category-summary">
                  <span className="category-name">{category.title}</span>
                  <span className="category-progress">{checked}/{total}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
