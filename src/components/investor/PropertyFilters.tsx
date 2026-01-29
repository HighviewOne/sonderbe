import { useState } from 'react'
import type { PropertySearchParams } from '../../lib/supabase'

const COUNTIES = ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura']
const LEAD_TYPES = [
  { value: 'foreclosure_nod', label: 'NOD (Notice of Default)' },
  { value: 'foreclosure_not', label: 'NOT (Notice of Trustee Sale)' },
  { value: 'probate', label: 'Probate' },
  { value: 'tax_lien', label: 'Tax Lien' },
  { value: 'tax_sale', label: 'Tax Sale' }
]

interface PropertyFiltersProps {
  params: PropertySearchParams
  onFilter: (params: Partial<PropertySearchParams>) => void
}

export function PropertyFilters({ params, onFilter }: PropertyFiltersProps) {
  const [search, setSearch] = useState(params.search || '')

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFilter({ search })
  }

  return (
    <div className="property-filters">
      <form onSubmit={handleSearchSubmit} className="filter-search">
        <input
          type="text"
          placeholder="Search address, owner, APN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="btn btn-primary btn-small">Search</button>
      </form>

      <div className="filter-row">
        <div className="filter-group">
          <label>County</label>
          <select
            value={params.county || ''}
            onChange={e => onFilter({ county: e.target.value as any || undefined })}
          >
            <option value="">All Counties</option>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label>Lead Type</label>
          <select
            value={params.lead_type || ''}
            onChange={e => onFilter({ lead_type: e.target.value as any || undefined })}
          >
            <option value="">All Types</option>
            {LEAD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label>Min Equity</label>
          <input
            type="number"
            placeholder="$0"
            value={params.min_equity || ''}
            onChange={e => onFilter({ min_equity: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>

        <div className="filter-group">
          <label>Max Equity</label>
          <input
            type="number"
            placeholder="No max"
            value={params.max_equity || ''}
            onChange={e => onFilter({ max_equity: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>

        <div className="filter-group">
          <label>City</label>
          <input
            type="text"
            placeholder="City"
            value={params.city || ''}
            onChange={e => onFilter({ city: e.target.value || undefined })}
          />
        </div>

        <div className="filter-group">
          <label>ZIP</label>
          <input
            type="text"
            placeholder="ZIP"
            value={params.zip || ''}
            onChange={e => onFilter({ zip: e.target.value || undefined })}
          />
        </div>
      </div>
    </div>
  )
}
