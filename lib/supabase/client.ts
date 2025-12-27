'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/lib/types/supabase';

/**
 * Creates a Supabase client for use in client components
 * This client is safe to use in browser environments
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

