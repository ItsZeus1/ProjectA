import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Profile } from "@/lib/types";

/**
 * Cookie-aware Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * IMPORTANT: this function is async. Every caller MUST write:
 *   const supabase = await createClient();
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: middleware.ts refreshes the session cookies.
          }
        },
      },
    }
  );
}

/**
 * Privileged client that bypasses Row Level Security.
 * SERVER ONLY. Never import this file from a "use client" component.
 *
 * Falls back to the anon key when SUPABASE_SERVICE_ROLE_KEY is missing so that
 * sign-up can still degrade gracefully. Money-moving and admin features need the
 * real service role key — check `hasServiceRoleKey()` before relying on them.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Convenience helper used by pages, the navbar and every Server Action:
 * returns the verified auth user (validated against Supabase, not just the cookie)
 * plus their profile row.
 */
export async function getCurrentProfile(): Promise<{
  user: User | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: (profile as Profile | null) ?? null };
}
