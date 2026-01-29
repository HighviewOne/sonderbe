import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiGet } from '../../lib/api'
import type { DistressedProperty } from '../../lib/supabase'

const LEAD_TYPE_LABELS: Record<string, string> = {
  foreclosure_nod: 'Notice of Default (NOD)',
  foreclosure_not: 'Notice of Trustee Sale (NOT)',
  probate: 'Probate',
  tax_lien: 'Tax Lien',
  tax_sale: 'Tax Sale'
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function PropertyDetail() {
  const { id } = useParams()
  const [property, setProperty] = useState<DistressedProperty | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    apiGet<DistressedProperty>(`/investor/properties/${id}`)
      .then(setProperty)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading property...</p>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div>
        <Link to="/investor/search" className="back-link">Back to Search</Link>
        <div className="error-message">{error || 'Property not found'}</div>
      </div>
    )
  }

  return (
    <div className="property-detail">
      <Link to="/investor/search" className="back-link">Back to Search</Link>

      <div className="property-detail-header">
        <h1>{property.property_address || 'Property Details'}</h1>
        <span className={`lead-type-badge lead-type-${property.lead_type}`}>
          {LEAD_TYPE_LABELS[property.lead_type]}
        </span>
      </div>

      <div className="property-detail-grid">
        <div className="detail-section">
          <h2>Location</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Address</label>
              <span>{property.property_address || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>City</label>
              <span>{property.city || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>ZIP</label>
              <span>{property.zip || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>County</label>
              <span>{property.county}</span>
            </div>
            <div className="info-item">
              <label>APN</label>
              <span>{property.apn || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h2>Owner Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Owner Name</label>
              <span>{property.owner_name || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Mailing Address</label>
              <span>{property.owner_mailing_address || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h2>Financial Details</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Estimated Value</label>
              <span>{formatCurrency(property.estimated_value)}</span>
            </div>
            <div className="info-item">
              <label>Outstanding Debt</label>
              <span>{formatCurrency(property.outstanding_debt)}</span>
            </div>
            <div className="info-item">
              <label>Estimated Equity</label>
              <span className="equity-value">{formatCurrency(property.estimated_equity)}</span>
            </div>
            <div className="info-item">
              <label>Opening Bid</label>
              <span>{formatCurrency(property.opening_bid)}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h2>Case Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Recording Date</label>
              <span>{property.recording_date ? new Date(property.recording_date).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Document Number</label>
              <span>{property.document_number || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Case Number</label>
              <span>{property.case_number || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Sale Date</label>
              <span>{property.sale_date ? new Date(property.sale_date).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>

        {property.notes && (
          <div className="detail-section">
            <h2>Notes</h2>
            <p>{property.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
