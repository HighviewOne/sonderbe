import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiPost, apiGet, apiPut } from '../../lib/api'
import type { DistressedProperty, LeadType, County } from '../../lib/supabase'

const COUNTIES: County[] = ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura']
const LEAD_TYPES: { value: LeadType; label: string }[] = [
  { value: 'foreclosure_nod', label: 'NOD (Notice of Default)' },
  { value: 'foreclosure_not', label: 'NOT (Notice of Trustee Sale)' },
  { value: 'probate', label: 'Probate' },
  { value: 'tax_lien', label: 'Tax Lien' },
  { value: 'tax_sale', label: 'Tax Sale' }
]
const STATUSES = ['active', 'sold', 'redeemed', 'expired', 'removed']

export function PropertyForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    lead_type: '' as string,
    county: '' as string,
    property_address: '',
    city: '',
    zip: '',
    apn: '',
    owner_name: '',
    owner_mailing_address: '',
    estimated_value: '',
    outstanding_debt: '',
    estimated_equity: '',
    opening_bid: '',
    recording_date: '',
    document_number: '',
    case_number: '',
    status: 'active',
    sale_date: '',
    notes: '',
    source: ''
  })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiGet<DistressedProperty>(`/admin/properties?search=${id}`)
      .catch(() => null)

    // Fetch from admin properties list filtered by id
    const params = new URLSearchParams({ search: id, limit: '1' })
    apiGet<{ properties: DistressedProperty[] }>(`/admin/properties?${params}`)
      .then(data => {
        const p = data.properties.find(prop => prop.id === id)
        if (p) {
          setForm({
            lead_type: p.lead_type,
            county: p.county,
            property_address: p.property_address || '',
            city: p.city || '',
            zip: p.zip || '',
            apn: p.apn || '',
            owner_name: p.owner_name || '',
            owner_mailing_address: p.owner_mailing_address || '',
            estimated_value: p.estimated_value?.toString() || '',
            outstanding_debt: p.outstanding_debt?.toString() || '',
            estimated_equity: p.estimated_equity?.toString() || '',
            opening_bid: p.opening_bid?.toString() || '',
            recording_date: p.recording_date || '',
            document_number: p.document_number || '',
            case_number: p.case_number || '',
            status: p.status,
            sale_date: p.sale_date || '',
            notes: p.notes || '',
            source: p.source || ''
          })
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.lead_type || !form.county) {
      setError('Lead type and county are required')
      return
    }

    setSaving(true)
    const payload = {
      ...form,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      outstanding_debt: form.outstanding_debt ? parseFloat(form.outstanding_debt) : null,
      estimated_equity: form.estimated_equity ? parseFloat(form.estimated_equity) : null,
      opening_bid: form.opening_bid ? parseFloat(form.opening_bid) : null,
      recording_date: form.recording_date || null,
      sale_date: form.sale_date || null,
      property_address: form.property_address || null,
      city: form.city || null,
      zip: form.zip || null,
      apn: form.apn || null,
      owner_name: form.owner_name || null,
      owner_mailing_address: form.owner_mailing_address || null,
      document_number: form.document_number || null,
      case_number: form.case_number || null,
      notes: form.notes || null,
      source: form.source || null
    }

    try {
      if (isEdit) {
        await apiPut(`/admin/properties/${id}`, payload)
      } else {
        await apiPost('/admin/properties', payload)
      }
      navigate('/admin/properties')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner"></div></div>
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/admin/properties')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)', marginBottom: 16, display: 'block' }}>
        Back to Properties
      </button>

      <h1>{isEdit ? 'Edit Property' : 'Add Property'}</h1>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="property-form">
        <div className="form-row">
          <div className="form-group">
            <label>Lead Type *</label>
            <select name="lead_type" value={form.lead_type} onChange={handleChange} required>
              <option value="">Select type</option>
              {LEAD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>County *</label>
            <select name="county" value={form.county} onChange={handleChange} required>
              <option value="">Select county</option>
              {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={handleChange}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Property Address</label>
            <input name="property_address" value={form.property_address} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>City</label>
            <input name="city" value={form.city} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>ZIP</label>
            <input name="zip" value={form.zip} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>APN</label>
            <input name="apn" value={form.apn} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Owner Name</label>
            <input name="owner_name" value={form.owner_name} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Owner Mailing Address</label>
            <input name="owner_mailing_address" value={form.owner_mailing_address} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Estimated Value ($)</label>
            <input name="estimated_value" type="number" value={form.estimated_value} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Outstanding Debt ($)</label>
            <input name="outstanding_debt" type="number" value={form.outstanding_debt} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Estimated Equity ($)</label>
            <input name="estimated_equity" type="number" value={form.estimated_equity} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Opening Bid ($)</label>
            <input name="opening_bid" type="number" value={form.opening_bid} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Recording Date</label>
            <input name="recording_date" type="date" value={form.recording_date} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Document Number</label>
            <input name="document_number" value={form.document_number} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Case Number</label>
            <input name="case_number" value={form.case_number} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Sale Date</label>
            <input name="sale_date" type="date" value={form.sale_date} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Source</label>
            <input name="source" value={form.source} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group">
          <label>Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Update Property' : 'Add Property'}
        </button>
      </form>
    </div>
  )
}
