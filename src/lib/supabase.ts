import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Note: For full type safety, generate types using: npx supabase gen types typescript
// After setting up your Supabase project, run that command and update database.types.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
