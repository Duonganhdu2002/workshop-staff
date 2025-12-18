import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check if environment variables are configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== '' && 
    supabaseAnonKey !== '' &&
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 20)
}

// Create Supabase client with auth options
let supabaseClient: SupabaseClient

if (isSupabaseConfigured()) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  })
} else {
  // In development, show helpful error message
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
    console.error('\n❌ Supabase environment variables are missing!')
    console.error('\nPlease create a .env.local file in the staff directory with:')
    console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key')
    console.error('\nGet these values from your Supabase project: Settings > API\n')
  }
  // Create client with minimal valid format to prevent immediate crash
  // Operations will fail with clear error messages
  supabaseClient = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    }
  )
}

export const supabase = supabaseClient

export type Registration = {
  id: string
  name: string
  email: string
  phone: string
  workshop_date: string
  payment_status: 'pending' | 'verified' | 'sent'
  qr_code: string | null
  seat_number: number | null
  created_at: string
  updated_at: string
  payment_content?: string | null
  transfer_content?: string | null
  payment_method?: 'bank_transfer' | 'payos' | null
}

