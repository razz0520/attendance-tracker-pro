import { createClient } from '@supabase/supabase-js'

// These variables pull values from your .env file, not the code itself
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)