import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL environment variable')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
})
