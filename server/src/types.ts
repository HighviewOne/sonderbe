import type { Request } from 'express'

export interface AuthenticatedRequest extends Request {
  userId?: string
  userRole?: 'client' | 'admin' | 'investor'
}

export type Profile = {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: 'client' | 'admin' | 'investor'
  created_at: string
  updated_at: string
}

export type ContactSubmission = {
  id: string
  user_id: string | null
  name: string
  email: string
  phone: string
  situation: string
  message: string | null
  status: 'new' | 'in_progress' | 'resolved' | 'archived'
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export type ChecklistProgress = {
  id: string
  user_id: string
  category_index: number
  item_index: number
  is_checked: boolean
  checked_at: string | null
  created_at: string
}

export type Document = {
  id: string
  user_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  category: string | null
  status: 'uploaded' | 'reviewed' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export type LeadType = 'foreclosure_nod' | 'foreclosure_not' | 'probate' | 'tax_lien' | 'tax_sale'
export type County = 'Los Angeles' | 'Orange' | 'Riverside' | 'San Bernardino' | 'San Diego' | 'Ventura'
export type PropertyStatus = 'active' | 'sold' | 'redeemed' | 'expired' | 'removed'
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'inactive' | 'trialing'

export type DistressedProperty = {
  id: string
  lead_type: LeadType
  county: County
  property_address: string | null
  city: string | null
  zip: string | null
  apn: string | null
  owner_name: string | null
  owner_mailing_address: string | null
  estimated_value: number | null
  outstanding_debt: number | null
  estimated_equity: number | null
  opening_bid: number | null
  recording_date: string | null
  document_number: string | null
  case_number: string | null
  status: PropertyStatus
  sale_date: string | null
  notes: string | null
  source: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export type InvestorSubscription = {
  id: string
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  plan_id: string | null
  created_at: string
  updated_at: string
}

export type PropertySearchParams = {
  county?: County
  lead_type?: LeadType
  city?: string
  zip?: string
  status?: PropertyStatus
  min_equity?: number
  max_equity?: number
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export type CsvUpload = {
  id: string
  uploaded_by: string
  file_name: string
  lead_type: LeadType
  county: County
  row_count: number
  error_count: number
  errors: Record<string, string>[] | null
  created_at: string
}
