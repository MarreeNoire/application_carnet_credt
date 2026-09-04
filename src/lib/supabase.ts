import { createClient } from '@supabase/supabase-js'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

// Vérifie que l'URL commence bien par http:// ou https://
const supabaseUrl = (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')))
  ? rawUrl
  : 'https://placeholder.supabase.co'

const supabaseAnonKey = rawKey || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)