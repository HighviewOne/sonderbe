import { useState } from 'react'
import { apiUpload } from '../../lib/api'
import type { LeadType, County } from '../../lib/supabase'

const COUNTIES: County[] = ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura']
const LEAD_TYPES: { value: LeadType; label: string }[] = [
  { value: 'foreclosure_nod', label: 'NOD (Notice of Default)' },
  { value: 'foreclosure_not', label: 'NOT (Notice of Trustee Sale)' },
  { value: 'probate', label: 'Probate' },
  { value: 'tax_lien', label: 'Tax Lien' },
  { value: 'tax_sale', label: 'Tax Sale' }
]

interface UploadResult {
  inserted: number
  errors: number
  errorDetails: { row: number; message: string }[]
  total: number
}

export function CsvUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [leadType, setLeadType] = useState<LeadType | ''>('')
  const [county, setCounty] = useState<County | ''>('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !leadType || !county) {
      setError('Please select a file, lead type, and county')
      return
    }

    setUploading(true)
    setError('')
    setResult(null)

    try {
      const data = await apiUpload<UploadResult>(
        '/admin/properties/csv-upload',
        file,
        { lead_type: leadType, county }
      )
      setResult(data)
      setFile(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>CSV Upload</h1>
        <p>Bulk import distressed property data from CSV files</p>
      </div>

      <form onSubmit={handleSubmit} className="csv-upload-form">
        <div className="form-row">
          <div className="form-group">
            <label>Lead Type *</label>
            <select value={leadType} onChange={e => setLeadType(e.target.value as LeadType)} required>
              <option value="">Select type</option>
              {LEAD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>County *</label>
            <select value={county} onChange={e => setCounty(e.target.value as County)} required>
              <option value="">Select county</option>
              {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>CSV File *</label>
          <input
            type="file"
            accept=".csv"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </button>
      </form>

      {result && (
        <div className="csv-result" style={{ marginTop: 24 }}>
          <div className={`csv-result-summary ${result.errors > 0 ? 'has-errors' : ''}`}>
            <h3>Upload Complete</h3>
            <p>{result.inserted} of {result.total} rows imported successfully</p>
            {result.errors > 0 && <p>{result.errors} rows had errors</p>}
          </div>

          {result.errorDetails.length > 0 && (
            <div className="csv-errors">
              <h4>Errors:</h4>
              <ul>
                {result.errorDetails.map((err, i) => (
                  <li key={i}>Row {err.row}: {err.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="document-tips" style={{ marginTop: 32 }}>
        <h3>CSV Format</h3>
        <p>Your CSV should include headers matching these column names:</p>
        <ul>
          <li><strong>property_address</strong> (or address) - Street address</li>
          <li><strong>city</strong> - City name</li>
          <li><strong>zip</strong> (or zip_code) - ZIP code</li>
          <li><strong>apn</strong> - Assessor Parcel Number</li>
          <li><strong>owner_name</strong> (or owner) - Property owner</li>
          <li><strong>owner_mailing_address</strong> (or mailing_address)</li>
          <li><strong>estimated_value</strong>, <strong>outstanding_debt</strong>, <strong>estimated_equity</strong>, <strong>opening_bid</strong> - Dollar amounts</li>
          <li><strong>recording_date</strong>, <strong>sale_date</strong> - Dates (YYYY-MM-DD)</li>
          <li><strong>document_number</strong>, <strong>case_number</strong></li>
          <li><strong>notes</strong>, <strong>source</strong></li>
        </ul>
        <p>Each row must have at least a <strong>property_address</strong> or <strong>apn</strong>.</p>
      </div>
    </div>
  )
}
