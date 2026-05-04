import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabaseSetupMessage =
  'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect the live FCFS workflow.'

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: false },
      global: {
        headers: {
          'x-client-info': 'orosubmit-fcfs-web',
        },
      },
    })
  : null
