import { useState, useRef } from 'react'
import { useDocuments } from '../../hooks/useDocuments'
import { checklistData } from '../../lib/constants'

export function DocumentUpload() {
  const { documents, uploading, error, uploadDocument, deleteDocument, getDownloadUrl } = useDocuments()
  const [selectedCategory, setSelectedCategory] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFiles(e.target.files)
    }
  }

  const handleFiles = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      await uploadDocument(files[i], selectedCategory || undefined)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (doc: typeof documents[0]) => {
    const url = await getDownloadUrl(doc.file_path, doc.id)
    if (url) {
      window.open(url, '_blank')
    }
  }

  const handleDelete = async (doc: typeof documents[0]) => {
    if (deleteConfirm === doc.id) {
      await deleteDocument(doc.id, doc.file_path)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(doc.id)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved': return 'badge-success'
      case 'rejected': return 'badge-error'
      case 'reviewed': return 'badge-warning'
      default: return 'badge-default'
    }
  }

  return (
    <div className="document-upload">
      <div className="upload-header">
        <h1>My Documents</h1>
        <p>Upload and manage documents for your loan modification application</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="upload-section">
        <div className="upload-controls">
          <div className="form-group">
            <label htmlFor="category">Document Category (Optional)</label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">General / Uncategorized</option>
              {checklistData.map((cat, index) => (
                <option key={index} value={cat.title}>{cat.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div
          className={`upload-dropzone ${dragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            className="file-input"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
          />
          {uploading ? (
            <div className="upload-progress">
              <div className="loading-spinner"></div>
              <p>Uploading...</p>
            </div>
          ) : (
            <>
              <div className="upload-icon">+</div>
              <p className="upload-text">
                Drag and drop files here, or click to select
              </p>
              <p className="upload-hint">
                Accepted: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
              </p>
            </>
          )}
        </div>
      </div>

      <div className="documents-section">
        <h2>Uploaded Documents ({documents.length})</h2>

        {documents.length === 0 ? (
          <div className="empty-state">
            <p>No documents uploaded yet.</p>
            <p>Upload your first document to get started.</p>
          </div>
        ) : (
          <div className="documents-list">
            {documents.map(doc => (
              <div key={doc.id} className="document-card">
                <div className="doc-icon">
                  {doc.mime_type?.includes('pdf') ? 'PDF' :
                   doc.mime_type?.includes('image') ? 'IMG' : 'DOC'}
                </div>
                <div className="doc-info">
                  <h3 className="doc-name">{doc.file_name}</h3>
                  <div className="doc-meta">
                    <span>{formatFileSize(doc.file_size)}</span>
                    {doc.category && <span className="doc-category">{doc.category}</span>}
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="doc-status">
                  <span className={`status-badge ${getStatusBadgeClass(doc.status)}`}>
                    {doc.status}
                  </span>
                </div>
                <div className="doc-actions">
                  <button
                    className="btn btn-icon"
                    onClick={() => handleDownload(doc)}
                    title="Download"
                  >
                    DL
                  </button>
                  <button
                    className={`btn btn-icon ${deleteConfirm === doc.id ? 'btn-danger' : ''}`}
                    onClick={() => handleDelete(doc)}
                    title={deleteConfirm === doc.id ? 'Click again to confirm' : 'Delete'}
                  >
                    {deleteConfirm === doc.id ? '?' : 'X'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="document-tips">
        <h3>Tips for Uploading Documents</h3>
        <ul>
          <li>Use clear, readable scans or photos</li>
          <li>Make sure all pages are included for multi-page documents</li>
          <li>Name your files descriptively (e.g., "2024-W2-John-Smith.pdf")</li>
          <li>Keep original documents in a safe place</li>
        </ul>
      </div>
    </div>
  )
}
