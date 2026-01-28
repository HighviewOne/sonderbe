import type { Request } from 'express'

export interface AuthenticatedRequest extends Request {
  userId?: string
  userRole?: 'client' | 'admin'
}

export type Profile = {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: 'client' | 'admin'
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
