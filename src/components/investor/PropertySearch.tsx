import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProperties } from '../../hooks/useProperties'
import { PropertyFilters } from './PropertyFilters'
import { PropertyTable } from './PropertyTable'
import type { LeadType, County } from '../../lib/supabase'

export function PropertySearch() {
  const [searchParams] = useSearchParams()
  const initialLeadType = searchParams.get('lead_type') as LeadType | null
  const initialCounty = searchParams.get('county') as County | null

  const { properties, loading, total, page, totalPages, params, updateParams, goToPage } = useProperties({
    ...(initialLeadType && { lead_type: initialLeadType }),
    ...(initialCounty && { county: initialCounty })
  })

  useEffect(() => {
    const lt = searchParams.get('lead_type') as LeadType | null
    const c = searchParams.get('county') as County | null
    if (lt || c) {
      updateParams({
        ...(lt && { lead_type: lt }),
        ...(c && { county: c })
      })
    }
  }, [searchParams, updateParams])

  return (
    <div className="property-search">
      <div className="page-header">
        <h1>Property Search</h1>
        <p>Search distressed properties across six Southern California counties</p>
      </div>

      <PropertyFilters params={params} onFilter={updateParams} />

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Searching properties...</p>
        </div>
      ) : (
        <PropertyTable
          properties={properties}
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={goToPage}
        />
      )}
    </div>
  )
}
