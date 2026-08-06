'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client for the sign-in page.
 *
 * The anon key is public by design — it identifies the project, and row-level
 * security is what actually protects data. Only the service-role key and the
 * JWT secret are secrets, and neither is ever sent to a browser.
 *
 * `persistSession` is off: this page's whole job is to hand a session to the
 * extension and get out of the way. Leaving a copy in the browser's localStorage
 * would mean a shared computer keeps someone signed in to a page they visited
 * once, for a session they meant to give to their own extension.
 */
let client: SupabaseClient | undefined;

export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // The session is read out of the URL fragment when the emailed link
          // lands here, handed straight to the extension, and then forgotten.
          detectSessionInUrl: true,
          // Deliberately not kept: this page's whole job is to pass a session
          // along. A copy in localStorage would leave a shared computer signed
          // in to a page someone visited once.
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }
  return client;
}
