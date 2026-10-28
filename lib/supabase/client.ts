import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for "use client" components
 * (live search, realtime balance refresh, and similar).
 *
 * Only the public anon key is ever exposed here. Row Level Security
 * decides what the logged-in user can read.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
