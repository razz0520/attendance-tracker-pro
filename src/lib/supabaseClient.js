import { createClient } from '@supabase/supabase-js'

// Pulling from the .env "vault" you just created
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase Environment Variables!")
}

export const supabase = createClient(supabaseUrl, supabaseKey)