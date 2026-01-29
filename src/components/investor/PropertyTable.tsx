import { Link } from 'react-router-dom'
import type { DistressedProperty } from '../../lib/supabase'

const LEAD_TYPE_LABELS: Record<string, string> = {
  foreclosure_nod: 'NOD',
  foreclosure_not: 'NOT',
  probate: 'Probate',
  tax_lien: 'Tax Lien',
  tax_sale: 'Tax Sale'
}

interface PropertyTableProps {
  properties: DistressedProperty[]
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function PropertyTable({ properties, page, totalPages, total, onPageChange }: PropertyTableProps) {
  if (properties.length === 0) {
    return <div className="empty-state"><p>No properties found matching your criteria.</p></div>
  }

  return (
    <div className="property-table-wrapper">
      <p className="results-count">{total} properties found</p>
      <div className="table-container">
        <table className="admin-table property-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Address</th>
              <th>City</th>
              <th>County</th>
              <th>Owner</th>
              <th>Est. Equity</th>
              <th>Recording Date</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {properties.map(p => (
              <tr key={p.id}>
                <td><span className={`lead-type-badge lead-type-${p.lead_type}`}>{LEAD_TYPE_LABELS[p.lead_type]}</span></td>
                <td>{p.property_address || '-'}</td>
                <td>{p.city || '-'}</td>
                <td>{p.county}</td>
                <td>{p.owner_name || '-'}</td>
                <td>{formatCurrency(p.estimated_equity)}</td>
                <td>{p.recording_date ? new Date(p.recording_date).toLocaleDateString() : '-'}</td>
                <td><Link to={`/investor/properties/${p.id}`} className="btn btn-small btn-secondary">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-small"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button
            className="btn btn-small"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
