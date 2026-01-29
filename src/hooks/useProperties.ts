import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '../lib/api'
import type { DistressedProperty, PropertySearchParams } from '../lib/supabase'

interface PropertiesResponse {
  properties: DistressedProperty[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export function useProperties(initialParams?: Partial<PropertySearchParams>) {
  const [properties, setProperties] = useState<DistressedProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [params, setParams] = useState<PropertySearchParams>({
    page: 1,
    limit: 25,
    sort_by: 'created_at',
    sort_order: 'desc',
    ...initialParams
  })

  const fetchProperties = useCallback(async (searchParams: PropertySearchParams) => {
    setLoading(true)
    try {
      const queryParts: string[] = []
      if (searchParams.county) queryParts.push(`county=${encodeURIComponent(searchParams.county)}`)
      if (searchParams.lead_type) queryParts.push(`lead_type=${searchParams.lead_type}`)
      if (searchParams.city) queryParts.push(`city=${encodeURIComponent(searchParams.city)}`)
      if (searchParams.zip) queryParts.push(`zip=${searchParams.zip}`)
      if (searchParams.status) queryParts.push(`status=${searchParams.status}`)
      if (searchParams.min_equity) queryParts.push(`min_equity=${searchParams.min_equity}`)
      if (searchParams.max_equity) queryParts.push(`max_equity=${searchParams.max_equity}`)
      if (searchParams.date_from) queryParts.push(`date_from=${searchParams.date_from}`)
      if (searchParams.date_to) queryParts.push(`date_to=${searchParams.date_to}`)
      if (searchParams.search) queryParts.push(`search=${encodeURIComponent(searchParams.search)}`)
      if (searchParams.page) queryParts.push(`page=${searchParams.page}`)
      if (searchParams.limit) queryParts.push(`limit=${searchParams.limit}`)
      if (searchParams.sort_by) queryParts.push(`sort_by=${searchParams.sort_by}`)
      if (searchParams.sort_order) queryParts.push(`sort_order=${searchParams.sort_order}`)

      const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
      const data = await apiGet<PropertiesResponse>(`/investor/properties${query}`)

      setProperties(data.properties)
      setTotal(data.total)
      setPage(data.page)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching properties:', error)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProperties(params)
  }, [params, fetchProperties])

  const updateParams = useCallback((newParams: Partial<PropertySearchParams>) => {
    setParams(prev => ({ ...prev, ...newParams, page: newParams.page ?? 1 }))
  }, [])

  const goToPage = useCallback((newPage: number) => {
    setParams(prev => ({ ...prev, page: newPage }))
  }, [])

  return { properties, loading, total, page, totalPages, params, updateParams, goToPage, refetch: () => fetchProperties(params) }
}
