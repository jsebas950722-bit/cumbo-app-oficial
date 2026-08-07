import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Cumbo] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en tu .env — ' +
      'copia .env.example a .env y completa con los datos de tu proyecto Supabase.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
