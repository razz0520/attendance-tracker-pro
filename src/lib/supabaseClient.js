import { createClient } from '@supabase/supabase-js'

// Pulling from the .env "vault" you just created
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase Environment Variables! Please check your .env file and restart the development server.")
}

export const supabase = createClient(supabaseUrl, supabaseKey)