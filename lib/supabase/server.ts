import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJSClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/lib/types/supabase';

/**
 * Creates a Supabase client for use in Server Components and API routes
 * This client reads cookies to maintain session state
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client with service role key for admin operations
 * WARNING: Only use this in server-side code, never expose to client
 * This bypasses RLS and should only be used for server-side operations
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY environment variable is not set
 */
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY environment variable is not set. This is required for service role operations.'
    );
  }

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL environment variable is not set. This is required for Supabase client initialization.'
    );
  }

  return createSupabaseJSClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

