import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiDelete } from '../../lib/api'
import type { DistressedProperty } from '../../lib/supabase'

const LEAD_TYPE_LABELS: Record<string, string> = {
  foreclosure_nod: 'NOD',
  foreclosure_not: 'NOT',
  probate: 'Probate',
  tax_lien: 'Tax Lien',
  tax_sale: 'Tax Sale'
}

const COUNTIES = ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura']
const LEAD_TYPES = ['foreclosure_nod', 'foreclosure_not', 'probate', 'tax_lien', 'tax_sale']

interface PropertiesResponse {
  properties: DistressedProperty[]
  total: number
  page: number
  totalPages: number
}

export function PropertyManager() {
  const [properties, setProperties] = useState<DistressedProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [county, setCounty] = useState('')
  const [leadType, setLeadType] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '25')
    if (county) params.set('county', county)
    if (leadType) params.set('lead_type', leadType)
    if (search) params.set('search', search)

    try {
      const data = await apiGet<PropertiesResponse>(`/admin/properties?${params}`)
      setProperties(data.properties)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, county, leadType, search])

  useEffect(() => { fetchProperties() }, [fetchProperties])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this property?')) return
    try {
      await apiDelete(`/admin/properties/${id}`)
      fetchProperties()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Property Management</h1>
        <p>{total} properties in database</p>
      </div>

      <div className="property-admin-controls">
        <Link to="/admin/properties/new" className="btn btn-primary btn-small">Add Property</Link>
        <Link to="/admin/properties/csv" className="btn btn-secondary btn-small">CSV Upload</Link>
      </div>

      <div className="filter-row" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSearch} className="filter-search">
          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary btn-small">Search</button>
        </form>
        <select value={county} onChange={e => { setCounty(e.target.value); setPage(1) }}>
          <option value="">All Counties</option>
          {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={leadType} onChange={e => { setLeadType(e.target.value); setPage(1) }}>
          <option value="">All Types</option>
          {LEAD_TYPES.map(t => <option key={t} value={t}>{LEAD_TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Address</th>
                  <th>City</th>
                  <th>County</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map(p => (
                  <tr key={p.id}>
                    <td><span className={`lead-type-badge lead-type-${p.lead_type}`}>{LEAD_TYPE_LABELS[p.lead_type]}</span></td>
                    <td>{p.property_address || p.apn || '-'}</td>
                    <td>{p.city || '-'}</td>
                    <td>{p.county}</td>
                    <td><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                    <td className="actions-cell">
                      <Link to={`/admin/properties/${p.id}/edit`} className="btn btn-small">Edit</Link>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {properties.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center' }}>No properties found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <button className="btn btn-small" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
