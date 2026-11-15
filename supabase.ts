import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(url && key);

// Valeurs de repli pour que la compilation passe sans configuration ;
// l'écran de connexion signale clairement l'absence de configuration.
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
});
